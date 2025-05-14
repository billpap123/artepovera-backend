// src/models/Artist.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import  User  from './User';
// ... other imports if any

interface ArtistAttributes {
  artist_id: number;
  user_id: number;
  bio: string | null;
  profile_picture: string | null;
  is_student: boolean;
  // --- ADD NEW CV FIELDS ---
  cv_url: string | null;
  cv_public_id: string | null;
  // --- END ADD ---
  // Add created_at, updated_at if you manage them here and not via underscored:true
}

// Make new fields optional on creation
interface ArtistCreationAttributes extends Optional<ArtistAttributes, 'artist_id' | 'bio' | 'profile_picture' | 'cv_url' | 'cv_public_id'> {}

class Artist extends Model<ArtistAttributes, ArtistCreationAttributes> implements ArtistAttributes {
  public artist_id!: number;
  public user_id!: number;
  public bio!: string | null;
  public profile_picture!: string | null;
  public is_student!: boolean;
  // --- ADD PUBLIC PROPERTIES ---
  public cv_url!: string | null;
  public cv_public_id!: string | null;
  // --- END ADD ---

  public readonly created_at!: Date; // Or createdAt
  public readonly updatedAt!: Date; // Or updatedAt

  // Associations can be defined here or in associations.ts
  public readonly user?: User;
}

Artist.init(
  {
    artist_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profile_picture: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_student: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // --- ADD COLUMN DEFINITIONS FOR CV ---
    cv_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    cv_public_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // --- END ADD ---
  },
  {
    sequelize,
    tableName: 'artists',
    timestamps: true, // Assuming you use these
    underscored: true, // If your DB columns are created_at, updated_at
  }
);

export default Artist;