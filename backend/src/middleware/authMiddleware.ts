import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface DecodedToken extends JwtPayload {
  id: number;
  username: string;
  user_type: string;
}

// ✅ Ensure the request includes user, params, query, and body
export interface CustomRequest extends Request {
  user?: DecodedToken;
  params: { [key: string]: string };  // ✅ Ensure params exist
  query: { [key: string]: string };   // ✅ Ensure query exists
  body: any;                          // ✅ Ensure body exists
}

// Note: we now declare it returns `void` instead of returning a `Response`.
export const authenticate = (req: CustomRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Send the response, then `return;` on a new line
    res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
    return; 
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default_secret'
    ) as DecodedToken;

    req.user = decoded;
    next(); // No return needed here—just call next()
  } catch (error) {
    // Same pattern here: send the response, then return
    res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
    return;
  }
};
