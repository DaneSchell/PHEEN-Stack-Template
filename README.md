A template project for the PHEEN Stack (PostgreSQL, HTMX, ExpressJs, EJS, NodeJS) using Docker.

Download and Install Docker:

https://www.docker.com/

Download and Install Visual Studio Code:

https://code.visualstudio.com/

Install Git and open a Git Bash Terminal:

https://git-scm.com/

Change Directory (cd) to somewhere you want to download this template.

Clone this Repository by typing this into your terminal:

`git clone https://github.com/DaneSchell/PHEEN-Stack-Template`

Change Directory into the newly downloaded repository:

`cd pheen-stack-template`

Open Docker so that the Docker Engine is running.

Open your project files with Visual Studio Code by typing:

`code .`

Build the Docker image and containers and start them up by typing:

`docker compose up --build --watch`

Wait for confirmation that everything is running, you'll see:

```
app-1   | SOCKETIO: Running on port 9999.
app-1   | SERVER: Running on port 9000.
app-1   | DATABASE: Running on port 5432.
```

Visit http://localhost:9000/ and play around with the app.
