// models/Employer.ts
import { Model, DataTypes, BelongsToGetAssociationMixin, Association } from 'sequelize';
import sequelize from '../config/db';
import User from './User';

class Employer extends Model {
  public employer_id!: number;
  public user_id!: number;
  public bio?: string;
  public profile_picture?: string;

  // We'll define associations in associations.ts
  // If you want TypeScript hints, you can still declare them:
  public getUser!: BelongsToGetAssociationMixin<User>;
  public readonly user?: User; // user from the association

  public static associations: {
    user: Association<Employer, User>;
  };
}

Employer.init(
  {
    employer_id: {
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
  },
  {
    sequelize,
    tableName: 'employers',
    timestamps: true,
  }
);

export default Employer;
