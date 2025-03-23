// src/models/Artist.ts

import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

class Artist extends Model {
  public artist_id!: number;
  public user_id!: number;
  public bio!: string;
  public profile_picture!: string;
  public portfolio!: string;
  public is_student!: boolean; // <-- NEW
}

Artist.init(
  {
    artist_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profile_picture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    portfolio: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // New boolean field
    is_student: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'artists',
    // Adjust timestamps to match your preference:
    // - If you want createdAt/updatedAt columns, leave it true.
    // - Otherwise, set timestamps: false.
    timestamps: true,
  }
);

export default Artist;
