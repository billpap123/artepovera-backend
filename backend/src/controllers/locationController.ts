// src/controllers/locationController.ts
import { Request, Response } from 'express';
import User from '../models/User';
import { Sequelize, Op, WhereOptions } from 'sequelize'; // Import Op

export const getLocations = async (req: Request, res: Response): Promise<void> => {
    try {
        const userType = req.query.userType as 'Artist' | 'Employer' | undefined;

        const whereClause: WhereOptions = {};

        if (userType) {
            if (!['Artist', 'Employer'].includes(userType)) {
                res.status(400).json({ message: 'Invalid user type specified' });
                return;
            }
            whereClause.user_type = userType;
        } else {
            // If NO userType is specified, get both Artists and Employers
            whereClause.user_type = {
                [Op.in]: ['Artist', 'Employer']
            };
        }

        const users = await User.findAll({
            where: whereClause,
            attributes: [
                'user_id',
                'fullname',
                'user_type',
                [Sequelize.fn('ST_AsText', Sequelize.col('location')), 'location'],
            ],
        });

        const formattedUsers = users
            .map(user => {
                // --- THIS IS THE CORRECTED LINE ---
                // First cast to 'unknown', then to 'string'. This tells TypeScript we are sure about the type conversion.
                const locationText = user.getDataValue('location') as unknown as string | null;
                // --- END CORRECTION ---

                if (!locationText || !locationText.startsWith('POINT')) return null;

                const coordinates = locationText
                    .replace('POINT(', '')
                    .replace(')', '')
                    .split(' ')
                    .map(Number);

                const plainUser = user.toJSON();

                return {
                    user_id: plainUser.user_id,
                    fullname: plainUser.fullname,
                    user_type: plainUser.user_type,
                    location: {
                        latitude: coordinates[1],
                        longitude: coordinates[0],
                    },
                };
            })
            .filter(Boolean); // Remove null entries

        res.status(200).json({ locations: formattedUsers });

    } catch (error: any) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};