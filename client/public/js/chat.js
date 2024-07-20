document.addEventListener("DOMContentLoaded", () => {
    const username = document.getElementById('username').value;
    const socket = io('ws://localhost:9000');

    let oldestMessageId = null;
    let isLoadingOlderMessages = false;

    // Validate username
    if (!username || username.length < 3 || username.length > 20 || /[^a-zA-Z0-9_]/.test(username)) {
        console.error('Invalid username:', username);
        alert('Invalid username.');
        return;
    }

    // Handle image upload form submission
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = new FormData(uploadForm);

            fetch('/dashboard/upload-image', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Create an image message with a thumbnail
                    const message = `Image uploaded: <a href="${data.fileUrl}" target="_blank"><img src="${data.fileUrl}" alt="Uploaded Image" style="max-width: 150px; cursor: pointer;" /></a>`;
                    socket.emit('chat message', { username, message });
                } else {
                    console.error('Upload failed:', data.message);
                }
            })
            .catch(error => console.error('Error uploading image:', error));
        });
    }

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
                    newMessage.innerHTML = `${msg.username}: ${msg.message}`; // Use innerHTML to support HTML content
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

    // Function to scroll to the bottom of the messages container
    function scrollToBottom() {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Handle new chat messages
    socket.on('chat message', (msg) => {
        const messagesContainer = document.getElementById('messages');
        const newMessage = document.createElement('li');
        newMessage.innerHTML = `${msg.username}: ${msg.message}`; // Use innerHTML to support HTML content
        messagesContainer.appendChild(newMessage);

        // If the message contains an image, add a load event to handle scrolling
        const images = newMessage.getElementsByTagName('img');
        let imagesToLoad = images.length;

        if (imagesToLoad > 0) {
            Array.from(images).forEach((img) => {
                img.addEventListener('load', () => {
                    imagesToLoad--;
                    if (imagesToLoad === 0) {
                        scrollToBottom();
                    }
                });

                img.addEventListener('error', () => {
                    imagesToLoad--;
                    if (imagesToLoad === 0) {
                        scrollToBottom();
                    }
                });
            });
        } else {
            scrollToBottom();
        }
    });

    // Handle user connection
    socket.emit('user connected', username);

    // Handle chat form submission
    document.getElementById('chatForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (message.length === 0 || message.length > 500) { // Example constraints
            alert('Message cannot be empty or too long.');
            return;
        }

        socket.emit('chat message', { username, message });
        messageInput.value = '';
    });

    // Load older messages when scrolling to the top
    document.getElementById('messages').addEventListener('scroll', () => {
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer.scrollTop === 0) {
            loadOlderMessages();
        }
    });

    // Initial load of older messages
    loadOlderMessages();
});
