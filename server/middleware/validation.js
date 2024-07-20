const { body } = require('express-validator');

// Validation rules for registration
const registrationValidationRules = () => [
    body('username')
        .trim()
        .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters long.')
        .escape(),
    body('password')
        .trim()
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
        .escape(),
];

// Validation rules for updating username and password
const updateUsernameValidationRules = () => [
    body('newUsername')
        .trim()
        .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters long.')
        .escape(),
];

const updatePasswordValidationRules = () => [
    body('currentPassword')
        .trim()
        .notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .trim()
        .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
        .escape(),
];

// Validation rules for login
const loginValidationRules = () => [
    body('username')
        .trim()
        .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters long.')
        .escape(),
    body('password')
        .trim()
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
        .escape(),
];

module.exports = {
    registrationValidationRules,
    updateUsernameValidationRules,
    updatePasswordValidationRules,
    loginValidationRules // Export the new login validation rules
};
