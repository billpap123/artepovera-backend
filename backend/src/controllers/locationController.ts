import { Request, Response } from 'express';
import User from '../models/User';
import { Sequelize } from 'sequelize';

export const getLocations = async (req: Request, res: Response): Promise<void> => {
    try {
        const userType = req.query.userType as 'Artist' | 'Employer';

        // Validate userType
        if (!['Artist', 'Employer'].includes(userType)) {
            res.status(400).json({ message: 'Invalid user type' });
            return;
        }

        // Query users by user type
        const users = await User.findAll({
            where: { user_type: userType },
            attributes: [
                'user_id',
                'fullname',
                [Sequelize.fn('ST_AsText', Sequelize.col('location')), 'location'], // Convert location geometry to WKT text
            ],
        });

        // Parse WKT format to JSON
        const formattedUsers = users
            .map(user => {
                const locationText = user.getDataValue('location') as unknown as string; // Cast 'location' to string
                if (!locationText || !locationText.startsWith('POINT')) return null; // Skip invalid locations

                const coordinates = locationText
                    .replace('POINT(', '')
                    .replace(')', '')
                    .split(' ')
                    .map(Number);

                return {
                    ...user.toJSON(),
                    location: {
                        latitude: coordinates[1], // Latitude is the second value
                        longitude: coordinates[0], // Longitude is the first value
                    },
                };
            })
            .filter(Boolean); // Remove null entries

        res.status(200).json(formattedUsers);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
