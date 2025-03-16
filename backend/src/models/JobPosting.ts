// src/models/JobPosting.ts

import {
  Model,
  DataTypes,
  BelongsToGetAssociationMixin,
  Association,
} from 'sequelize';
import sequelize from '../config/db';
import Employer from './Employer';

class JobPosting extends Model {
  public job_id!: number;
  public employer_id!: number;
  public title!: string;
  public description!: string;
  public location!: { type: string; coordinates: [number, number] };
  public created_at!: Date;

  // These lines allow TypeScript to know there's an association with Employer
  public getEmployer!: BelongsToGetAssociationMixin<Employer>;
  public readonly employer?: Employer;

  public static associations: {
    employer: Association<JobPosting, Employer>;
  };
}

JobPosting.init(
  {
    job_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    employer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    location: {
      type: DataTypes.GEOMETRY('POINT'),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'job_postings',
    timestamps: false,
  }
);

export default JobPosting;
