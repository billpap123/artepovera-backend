// src/models/Portfolio.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import sequelize from '../config/db';
import Artist from './Artist'; // Ensure this path is correct

// --- ADDED: Define the possible item types ---
export type PortfolioItemType = 'image' | 'pdf' | 'video' | 'other';
// --- END ADD ---

interface PortfolioAttributes {
  portfolio_id: number;
  artist_id: number;
  image_url: string; // This will store the Cloudinary URL for any file type
  description?: string | null; // Made explicitly nullable if that's the case
  // --- ADDED NEW ATTRIBUTES ---
  item_type: PortfolioItemType;
  public_id: string | null; // Cloudinary public_id, can be null if not stored or for old items
  // --- END ADDED ---
  created_at?: Date; // Will be managed by Sequelize if underscored:true
  updated_at?: Date; // Will be managed by Sequelize if underscored:true
}

// For creation, some attributes are optional (like portfolio_id, description, public_id, and timestamps)
interface PortfolioCreationAttributes extends Optional<PortfolioAttributes, 'portfolio_id' | 'description' | 'public_id' | 'created_at' | 'updated_at'> {}

class Portfolio extends Model<PortfolioAttributes, PortfolioCreationAttributes> implements PortfolioAttributes {
  public portfolio_id!: number;
  public artist_id!: number;
  public image_url!: string;
  public description!: string | null;
  // --- ADDED PUBLIC PROPERTIES ---
  public item_type!: PortfolioItemType;
  public public_id!: string | null;
  // --- END ADDED ---

  // Timestamps (managed by Sequelize due to timestamps: true)
  public readonly created_at!: Date; // Use created_at due to underscored: true
  public readonly updatedAt!: Date; // Use updatedAt (JS name) -> updated_at (DB column)

  // Associations
  public readonly artist?: Artist; // If 'artist' alias is used in association
}

Portfolio.init(
  {
    portfolio_id: {
      type: DataTypes.INTEGER.UNSIGNED, // Using UNSIGNED if your DB uses it
      autoIncrement: true,
      primaryKey: true,
      // field: 'portfolio_id' // Only if DB column name is different than model attribute
    },
    artist_id: {
      type: DataTypes.INTEGER.UNSIGNED, // Assuming artist_id is also unsigned
      allowNull: false,
      references: { // Define foreign key relationship
        model: 'artists', // Name of the artists TABLE in your DB
        key: 'artist_id', // Primary key column in artists TABLE
      }
    },
    image_url: {
      type: DataTypes.STRING(1024), // Increased length for potentially long Cloudinary URLs
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // --- ADDED NEW COLUMN DEFINITIONS ---
    item_type: {
      type: DataTypes.ENUM('image', 'pdf', 'video', 'other'),
      allowNull: false,
      defaultValue: 'image', // Default to 'image' or 'other'
    },
    public_id: { // For storing Cloudinary's public_id
      type: DataTypes.STRING(255),
      allowNull: true, // Allow null for older items or if not always captured
    },
    // --- END ADDED ---
    // created_at and updated_at will be handled by Sequelize's timestamps option
  },
  {
    sequelize,
    tableName: 'artist_portfolios', // Your specified table name
    timestamps: true, // Enable Sequelize's automatic createdAt and updatedAt
    underscored: true, // This will make Sequelize expect DB columns as created_at and updated_at
                      // and map model attributes createdAt/updatedAt to these snake_case columns.
  }
);

// Define the association (if not already in a central associations.ts file)
// Ensure the foreignKey 'artist_id' here matches the attribute name in THIS Portfolio model.
// And targetKey 'artist_id' matches the PK attribute name in the Artist model.
// Portfolio.belongsTo(Artist, { foreignKey: 'artist_id', targetKey: 'artist_id', as: 'artist' });

export default Portfolio;