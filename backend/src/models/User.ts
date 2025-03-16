import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import Artist from './Artist';
import Employer from './Employer';

interface UserAttributes {
  user_id: number;
  username: string;
  email: string;
  password: string;
  fullname: string;
  phone_number: string | null;
  user_type: string;
  location: { type: string; coordinates: [number, number] } | null;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'user_id' | 'location' | 'phone_number'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public user_id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public fullname!: string;
  public phone_number!: string | null;
  public user_type!: string;
  public location!: { type: string; coordinates: [number, number] } | null;

  // ✅ Associations (defined later in associations.ts)
  public readonly artistProfile?: Artist | null;
  public readonly employerProfile?: Employer | null;
}

User.init(
  {
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fullname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    location: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: false,
  }
);

export default User;
