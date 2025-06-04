// src/models/ArtistSupport.ts
import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import sequelizeInstance from '../config/db';
import User from './User';

interface ArtistSupportAttributes {
  support_id: number;
  supporter_artist_user_id: number;
  supported_artist_user_id: number;
  created_at?: Date;
}

interface ArtistSupportCreationAttributes extends Optional<ArtistSupportAttributes, 'support_id' | 'created_at'> {}

class ArtistSupport extends Model<ArtistSupportAttributes, ArtistSupportCreationAttributes> implements ArtistSupportAttributes {
  public support_id!: number;
  public supporter_artist_user_id!: number;
  public supported_artist_user_id!: number;
  public readonly created_at!: Date;
}

ArtistSupport.init({
  support_id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  supporter_artist_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  supported_artist_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, {
  sequelize: sequelizeInstance,
  tableName: 'artist_supports',
  timestamps: true,
  updatedAt: false, // No 'updated_at' needed for a simple support action
  underscored: true,
});

export default ArtistSupport;