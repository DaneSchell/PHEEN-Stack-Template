function confirmDelete() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // Make a POST request to delete the account
      fetch('/delete-account', { method: 'POST' })
        .then(response => {
          if (response.ok) {
            window.location.href = '/';
          }
        });
    }
};