// src/models/Category.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';

export interface CategoryAttributes {
  category_id: number;
  name: string;
}

interface CategoryCreationAttributes extends Optional<CategoryAttributes, 'category_id'> {}

class Category extends Model<CategoryAttributes, CategoryCreationAttributes> implements CategoryAttributes {
  public category_id!: number;
  public name!: string;

  // Timestamps are disabled for this simple table
  public readonly createdAt!: false;
  public readonly updatedAt!: false;
}

Category.init({
    category_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    }
}, {
    sequelize,
    tableName: 'categories',
    timestamps: false // No need for createdAt/updatedAt on this table
});

export default Category;