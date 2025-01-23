document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const chatbox = document.getElementById('chatbox');
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const loadMoreButton = document.getElementById('loadMoreButton');
    const uploadForm = document.getElementById('uploadForm');
    const username = document.getElementById('username').value;
    let page = 1;
    let isLoading = false;

    // Connect to socket with username
    socket.emit('user connected', username);

    // Handle image uploads
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        
        try {
            const response = await fetch('/chat/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Upload failed');
            }
            
            const data = await response.json();
            socket.emit('chat message', {
                username: username,
                message: `[Image](${data.url})`,
                type: 'image'
            });
            
            uploadForm.reset();
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image');
        }
    });

    // Load older messages
    loadMoreButton.addEventListener('click', async () => {
        if (isLoading) return;
        isLoading = true;
        loadMoreButton.textContent = 'Loading...';
        
        try {
            const response = await fetch(`/chat/messages?page=${page}`);
            const messages = await response.json();
            
            if (messages.length === 0) {
                loadMoreButton.style.display = 'none';
                return;
            }
            
            const scrollHeight = chatbox.scrollHeight;
            
            messages.reverse().forEach(msg => {
                const li = createMessageElement(msg);
                chatbox.insertBefore(li, chatbox.firstChild);
            });
            
            chatbox.scrollTop = chatbox.scrollHeight - scrollHeight;
            page++;
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            isLoading = false;
            loadMoreButton.textContent = 'Load More Messages';
        }
    });

    // Handle sending messages
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        
        if (message) {
            socket.emit('chat message', {
                username: username,
                message: message,
                type: 'text'
            });
            messageInput.value = '';
        }
    });

    // Receive messages
    socket.on('chat message', (msg) => {
        const li = createMessageElement(msg);
        chatbox.appendChild(li);
        scrollToBottom();
    });

    function createMessageElement(msg) {
        const li = document.createElement('li');
        li.className = msg.username === username ? 'message sent' : 'message received';
        
        const userSpan = document.createElement('span');
        userSpan.className = 'username';
        userSpan.textContent = msg.username;
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'content';
        
        if (msg.type === 'image') {
            const imgUrl = msg.message.match(/\[Image\]\((.*?)\)/)[1];
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = 'Shared image';
            img.className = 'chat-image';
            contentSpan.appendChild(img);
        } else {
            contentSpan.textContent = msg.message;
        }
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'time';
        timeSpan.textContent = new Date(msg.timestamp).toLocaleTimeString();
        
        li.appendChild(userSpan);
        li.appendChild(contentSpan);
        li.appendChild(timeSpan);
        
        return li;
    }

    function scrollToBottom() {
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    // Initial load of messages
    loadMoreButton.click();
});
