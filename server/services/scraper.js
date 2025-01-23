const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const db = require('../middleware/db');
const { Configuration, OpenAIApi } = require('openai');

class NewsScraperService {
  constructor() {
    this.rssParser = new Parser();
    this.sources = [
      {
        name: 'NPR Politics',
        url: 'https://feeds.npr.org/1014/rss.xml',
        type: 'rss'
      },
      {
        name: 'Washington Post Politics',
        url: 'http://feeds.washingtonpost.com/rss/politics',
        type: 'rss'
      },
      {
        name: 'Google News - Trump',
        url: 'https://news.google.com/rss/search?q=donald+trump+when:1d&hl=en-US&gl=US&ceid=US:en',
        type: 'rss'
      }
    ];

    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.openai = new OpenAIApi(configuration);
    }

    // News API configuration
    this.newsApiKey = process.env.NEWS_API_KEY;
    this.newsApiUrl = 'https://newsapi.org/v2/everything';

    // Start periodic scraping
    this.startPeriodicScraping();
  }

  async saveResult(result) {
    try {
      await db.none(`
        INSERT INTO scraping_results 
        (source, url, title, published_at, analysis, timestamp)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        result.source,
        result.url,
        result.title,
        result.publishedAt,
        JSON.stringify(result.analysis)
      ]);
    } catch (error) {
      console.error('Error saving scraping result:', error);
      this.emitScrapingUpdate('Error saving result to database', { error: error.message });
    }
  }

  startPeriodicScraping() {
    // Run initial scrape
    this.scrapeAndAnalyze();

    // Then run every 5 minutes
    setInterval(() => {
      this.scrapeAndAnalyze();
    }, 5 * 60 * 1000);
  }

  emitScrapingUpdate(message, data = null) {
    if (this.io) {
      this.io.emit('scraping_update', {
        timestamp: new Date(),
        message,
        data
      });
    }
  }

  async scrapeWebPage(url) {
    try {
      this.emitScrapingUpdate(`Starting web scrape for ${url}`);
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const articles = [];

      // Truth Social specific scraping
      if (url.includes('truthsocial.com')) {
        $('.timeline-item').each((i, elem) => {
          const content = $(elem).find('.content').text().trim();
          const timestamp = $(elem).find('.timestamp').text().trim();
          if (content) {
            articles.push({
              title: content.substring(0, 100) + '...',
              description: content,
              publishedAt: timestamp,
              url: url,
              source: { name: 'Truth Social' }
            });
          }
        });
      }

      this.emitScrapingUpdate(`Completed web scrape for ${url}`, { articleCount: articles.length });
      return articles;
    } catch (error) {
      this.emitScrapingUpdate(`Error scraping ${url}: ${error.message}`);
      console.error(`Error scraping ${url}:`, error.message);
      return [];
    }
  }

  async fetchFromRSS(source) {
    try {
      this.emitScrapingUpdate(`Starting RSS fetch for ${source.name}`);
      const feed = await this.rssParser.parseURL(source.url);
      const articles = feed.items
        .filter(item => 
          item.title?.toLowerCase().includes('trump') || 
          item.content?.toLowerCase().includes('trump'))
        .map(item => ({
          title: item.title,
          description: item.content || item.contentSnippet,
          publishedAt: item.pubDate,
          url: item.link,
          source: { name: source.name }
        }));

      this.emitScrapingUpdate(`Completed RSS fetch for ${source.name}`, { 
        totalArticles: feed.items.length,
        trumpRelated: articles.length 
      });
      return articles;
    } catch (error) {
      this.emitScrapingUpdate(`Error fetching RSS from ${source.name}: ${error.message}`);
      console.error(`Error fetching RSS from ${source.url}:`, error.message);
      return [];
    }
  }

  async analyzeContent(text) {
    this.emitScrapingUpdate('Starting content analysis');
    
    const analysis = {
      companies: [],
      people: [],
      projects: [],
      industries: [],
      investments: []
    };

    // Basic company detection (looks for Inc., Corp., LLC)
    const companyRegex = /[A-Z][a-zA-Z\s]+(Inc\.|Corp\.|LLC|Company|Ltd\.)/g;
    analysis.companies = [...new Set(text.match(companyRegex) || [])];

    // Basic person detection (looks for capitalized words)
    const nameRegex = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g;
    analysis.people = [...new Set(text.match(nameRegex) || [])];

    // Basic money detection
    const moneyRegex = /\$\d+(?:\.\d{2})?(?:\s*(?:million|billion|trillion))?/g;
    analysis.investments = text.match(moneyRegex) || [];

    // Basic industry detection
    const industries = ['tech', 'technology', 'finance', 'healthcare', 'real estate', 'energy', 'manufacturing'];
    analysis.industries = industries.filter(industry => 
      text.toLowerCase().includes(industry)
    );

    this.emitScrapingUpdate('Completed content analysis', analysis);
    return analysis;
  }

  async scrapeAndAnalyze() {
    this.emitScrapingUpdate('Starting scraping cycle');
    const results = [];

    for (const source of this.sources) {
      let articles = [];
      if (source.type === 'rss') {
        articles = await this.fetchFromRSS(source);
      } else if (source.type === 'web') {
        articles = await this.scrapeWebPage(source.url);
      }

      for (const article of articles) {
        const analysis = await this.analyzeContent(article.title + ' ' + article.description);
        if (Object.values(analysis).some(arr => arr.length > 0)) {
          const result = {
            source: article.source.name,
            url: article.url,
            publishedAt: article.publishedAt,
            title: article.title,
            analysis
          };
          results.push(result);
          await this.saveResult(result);
          this.emitScrapingUpdate('Found relevant content', result);
        }
      }
    }

    this.emitScrapingUpdate('Completed scraping cycle', { 
      totalResults: results.length,
      timestamp: new Date() 
    });
    return results;
  }

  async fetchNews() {
    try {
      // Get active search terms
      const searchTerms = await db.manyOrNone('SELECT * FROM search_terms WHERE is_active = true');
      
      for (const term of searchTerms) {
        const response = await axios.get(this.newsApiUrl, {
          params: {
            q: term.term,
            apiKey: this.newsApiKey,
            language: 'en',
            sortBy: 'publishedAt'
          }
        });

        for (const article of response.data.articles) {
          // Check if article already exists
          const exists = await db.oneOrNone('SELECT id FROM news_articles WHERE url = $1', article.url);
          if (exists) continue;

          // Insert the article
          const insertedArticle = await db.one(
            'INSERT INTO news_articles (title, url, source, published_at, content) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [article.title, article.url, article.source.name, article.publishedAt, article.content]
          );

          // Analyze entities if OpenAI is configured
          if (this.openai) {
            await this.analyzeEntities(insertedArticle.id, article.title + ' ' + article.content);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  }

  async analyzeEntities(articleId, content) {
    try {
      const prompt = `
        Analyze the following news article and extract:
        1. People mentioned (excluding common pronouns)
        2. Company names
        3. Investment-related terms or values
        4. Overall sentiment (as a number between -1 and 1)
        
        Format the response as JSON with these keys:
        {
            "people": [{"name": "string", "context": "string"}],
            "companies": [{"name": "string", "context": "string"}],
            "investments": [{"term": "string", "context": "string"}],
            "sentiment": number
        }

        Article: ${content}
      `;

      const completion = await this.openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      });

      const analysis = JSON.parse(completion.data.choices[0].message.content);

      // Update article sentiment
      await db.none('UPDATE news_articles SET sentiment_score = $1 WHERE id = $2', 
        [analysis.sentiment, articleId]);

      // Insert entity mentions
      for (const person of analysis.people) {
        await db.none(
          'INSERT INTO entity_mentions (article_id, entity_name, entity_type, context) VALUES ($1, $2, $3, $4)',
          [articleId, person.name, 'person', person.context]
        );
      }

      for (const company of analysis.companies) {
        await db.none(
          'INSERT INTO entity_mentions (article_id, entity_name, entity_type, context) VALUES ($1, $2, $3, $4)',
          [articleId, company.name, 'company', company.context]
        );
      }

      for (const investment of analysis.investments) {
        await db.none(
          'INSERT INTO entity_mentions (article_id, entity_name, entity_type, context) VALUES ($1, $2, $3, $4)',
          [articleId, investment.term, 'investment', investment.context]
        );
      }
    } catch (error) {
      console.error('Error analyzing entities:', error);
    }
  }

  async generateInsights() {
    try {
      // Get recent articles and mentions
      const articles = await db.manyOrNone(`
        SELECT * FROM news_articles 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY published_at DESC
      `);

      const mentions = await db.manyOrNone(`
        SELECT * FROM entity_mentions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
      `);

      if (this.openai) {
        const prompt = `
          Analyze these news articles and entity mentions to identify trends and insights.
          Focus on relationships between people, companies, and investments.
          
          Articles: ${JSON.stringify(articles)}
          Mentions: ${JSON.stringify(mentions)}
          
          Format the response as JSON with these keys:
          {
              "key_trends": [string],
              "notable_relationships": [string],
              "investment_insights": [string]
          }
        `;

        const completion = await this.openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        });

        const insights = JSON.parse(completion.data.choices[0].message.content);

        // Cache the insights
        await db.none(`
          INSERT INTO analytics_cache (analysis_type, data, valid_until)
          VALUES ($1, $2, NOW() + INTERVAL '1 hour')
        `, ['daily_insights', insights]);

        return insights;
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    }
  }
}

// Create a singleton instance
const scraperService = new NewsScraperService();

// Export the singleton instance
module.exports = scraperService; 