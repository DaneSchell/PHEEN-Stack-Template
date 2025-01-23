document.addEventListener("DOMContentLoaded", () => {
    const deleteButton = document.getElementById('deleteAccountButton');

    deleteButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            fetch('/account/delete-account', { 
                method: 'POST',
                credentials: 'include', // Include credentials (cookies) in the request
                headers: {
                    'Content-Type': 'application/json' // Request body as JSON
                }
            })
            .then(response => {
                if (response.ok) {
                    window.location.href = '/login';
                } else {
                    alert('Failed to delete account');
                }
            })
            .catch(error => {
                console.error('Error deleting account:', error);
            });
        }
    });
});
