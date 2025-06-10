// src/controllers/category.controller.ts
import { Request, Response, NextFunction } from 'express';
import Category from '../models/Category';

export const getAllCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Fetch all categories from the database, ordered alphabetically
        const categories = await Category.findAll({
            order: [['name', 'ASC']]
        });
        
        // Send the list of categories as a JSON response
        res.status(200).json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        next(error); // Pass error to the global error handler
    }
};