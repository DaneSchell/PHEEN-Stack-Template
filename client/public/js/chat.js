document.addEventListener("DOMContentLoaded", () => {
    const username = document.getElementById('username').value;

    const socket = io('ws://localhost:9000');
    let oldestMessageId = null;
    let isLoadingOlderMessages = false;

    // Function to load older messages from server
    function loadOlderMessages() {
        if (isLoadingOlderMessages) return;
        console.log(`Loading older messages with oldestMessageId: ${oldestMessageId}`);

        isLoadingOlderMessages = true;
        const url = oldestMessageId ? `/dashboard/older-messages?oldestMessageId=${oldestMessageId}` : `/dashboard/older-messages`;
        fetch(url)
            .then(response => response.json())
            .then(messages => {
                if (!Array.isArray(messages)) {
                    console.error('Error loading older messages: Expected an array, but received:', messages);
                    return;
                }

                if (messages.length === 0) {
                    isLoadingOlderMessages = false;
                    return;
                }

                const messagesContainer = document.getElementById('messages');
                const scrollHeightBeforeAddingMessages = messagesContainer.scrollHeight;

                messages.reverse().forEach(msg => {
                    const newMessage = document.createElement('li');
                    newMessage.textContent = `${msg.username}: ${msg.message}`;
                    messagesContainer.insertBefore(newMessage, messagesContainer.firstChild);
                });

                messagesContainer.scrollTop = messagesContainer.scrollHeight - scrollHeightBeforeAddingMessages;

                oldestMessageId = messages[messages.length - 1].id;
                isLoadingOlderMessages = false;
            })
            .catch(error => {
                console.error('Error loading older messages:', error);
                isLoadingOlderMessages = false;
            });
    }

    socket.on('load messages', messages => {
        const messagesContainer = document.getElementById('messages');
        messages.forEach(msg => {
            const newMessage = document.createElement('li');
            newMessage.textContent = `${msg.username}: ${msg.message}`;
            messagesContainer.appendChild(newMessage);
        });

        oldestMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    socket.emit('user connected', username);

    document.getElementById('chatForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value;
        socket.emit('chat message', { username, message });
        messageInput.value = '';
    });

    socket.on('chat message', (msg) => {
        const messagesContainer = document.getElementById('messages');
        const newMessage = document.createElement('li');
        newMessage.textContent = `${msg.username}: ${msg.message}`;
        messagesContainer.appendChild(newMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    document.getElementById('messages').addEventListener('scroll', () => {
        if (document.getElementById('messages').scrollTop === 0) {
            loadOlderMessages();
        }
    });

    loadOlderMessages();
});
