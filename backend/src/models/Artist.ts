import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import User from './User';

class Artist extends Model {
  public artist_id!: number;
  public user_id!: number;
  public bio!: string;
  public profile_picture!: string;
  public portfolio!: string;
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
  },
  {
    sequelize,
    tableName: 'artists',
    timestamps: true,
  }
);
export default Artist;
