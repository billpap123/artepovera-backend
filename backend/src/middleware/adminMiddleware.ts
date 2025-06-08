// src/middleware/adminMiddleware.ts
import { Response, NextFunction } from 'express';
import { CustomRequest } from './authMiddleware'; // Import your CustomRequest type

/**
 * Checks if the authenticated user is an administrator.
 * This middleware MUST run AFTER the `authenticate` middleware.
 */
export const isAdmin = (req: CustomRequest, res: Response, next: NextFunction): void => {
    
    // The `authenticate` middleware should have already run and attached the user object to the request.
    const userType = req.user?.user_type;

    if (userType && userType === 'Admin') {
        // If the user type is 'Admin', allow the request to proceed to the next handler (the actual controller).
        next();
    } else {
        // If the user is not an admin, block the request and send a 'Forbidden' error.
        res.status(403).json({ message: 'Forbidden: Access is restricted to administrators.' });
    }
};