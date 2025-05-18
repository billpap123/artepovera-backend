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
  public city!: string;
  public address!: string;
  public budget!: number;
  public difficulty!: string;
  public deadline!: Date;
  public artist_category!: string;
  public insurance!: boolean;
  public created_at!: Date;

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
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    budget: {
      type: DataTypes.DECIMAL,
      allowNull: false,
    },
    difficulty: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    artist_category: {
      type: DataTypes.ENUM(
        'dancer',
        'painter',
        'digital_artist',
        'graphic_designer',
        'musician',
        'sculptor',
        'photographer',
        'actress',
        'actor',
        'comedian',
        'poet',
        'writer',
        'illustrator',
        'calligrapher',
        'filmmaker',
        'animator',
        'fashion_designer',
        'architect',
        'interior_designer',
        'jewelry_designer',
        'industrial_designer',
        'ceramicist',
        'woodworker'
      ),
      allowNull: false,
      defaultValue: 'digital_artist',
    },
    insurance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'job_postings',
    timestamps: true,
    underscored: true,
  }
);

export default JobPosting;
