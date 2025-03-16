import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import Artist from './Artist'; // Adjust if using User model instead of Artist

class Portfolio extends Model {
  public portfolio_id!: number;
  public artist_id!: number;
  public image_url!: string;
  public description?: string;
}

Portfolio.init(
  {
    portfolio_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'artist_portfolios',
    timestamps: true,
  }
);

// Define the association
Portfolio.belongsTo(Artist, { foreignKey: 'artist_id', targetKey: 'artist_id', as: 'artist' });

export default Portfolio;
