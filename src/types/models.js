/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} email
 * @property {string} phone
 * @property {string} password
 * @property {boolean} privacyConsent
 * @property {boolean} newsletterConsent
 * @property {boolean} approved
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Course
 * @property {string} id
 * @property {string} name
 * @property {number} duration
 * @property {number} capacity
 * @property {"group" | "personal"} mode
 */

/**
 * @typedef {Object} Appointment
 * @property {string} id
 * @property {string} userId
 * @property {string} courseId
 * @property {string} date
 * @property {string} startTime
 * @property {"booked" | "completed" | "no-show" | "cancelled"} status
 * @property {string} createdAt
 */

export {};
