// src/models/JobPosting.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelizeInstance from '../config/db';
import Employer from './Employer';

// This interface defines the structure of the JSON object for the 'requirements' column
export interface JobRequirements {
  military_service?: 'Completed' | 'Not Required' | 'Not Applicable';
  university_degree?: {
    required: boolean;
    details?: string;
  };
  foreign_languages?: { language: string; certificate: string; }[];
  experience_years?: '0-3' | '4-7' | '7-10' | '>10';
}

// This interface defines all the attributes of a JobPosting instance
export interface JobPostingAttributes {
  job_id: number;
  employer_id: number;
  title: string;
  category: string;
  description?: string | null;
  location?: string | null;
  presence: 'Physical' | 'Online' | 'Both';
  start_date?: Date | null;
  end_date?: Date | null;
  application_deadline?: Date | null;
  payment_total: number;
  payment_is_monthly?: boolean;
  payment_monthly_amount?: number | null;
  insurance?: boolean | null;
  desired_keywords?: string | null;
  requirements?: JobRequirements | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Defines which attributes are optional when creating a new job posting
interface JobPostingCreationAttributes extends Optional<JobPostingAttributes, 'job_id' | 'createdAt' | 'updatedAt' | 'description' | 'location' | 'start_date' | 'end_date' | 'application_deadline' | 'payment_is_monthly' | 'payment_monthly_amount' | 'insurance' | 'desired_keywords' | 'requirements'> {}

class JobPosting extends Model<JobPostingAttributes, JobPostingCreationAttributes> implements JobPostingAttributes {
  public job_id!: number;
  public employer_id!: number;
  public title!: string;
  public category!: string;
  public description!: string | null;
  public location!: string | null;
  public presence!: 'Physical' | 'Online' | 'Both';
  public start_date!: Date | null;
  public end_date!: Date | null;
  public application_deadline!: Date | null;
  public payment_total!: number;
  public payment_is_monthly!: boolean;
  public payment_monthly_amount!: number | null;
  public insurance!: boolean | null;
  public desired_keywords!: string | null;
  public requirements!: JobRequirements | null;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  public readonly employer?: Employer;
}

JobPosting.init({
  job_id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  employer_id: { type: DataTypes.INTEGER, allowNull: false }, // Should be INT to match employers.employer_id
  title: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  location: { type: DataTypes.STRING, allowNull: true },
  presence: { type: DataTypes.ENUM('Physical', 'Online', 'Both'), allowNull: false },
  start_date: { type: DataTypes.DATE, allowNull: true },
  end_date: { type: DataTypes.DATE, allowNull: true },
  application_deadline: { type: DataTypes.DATE, allowNull: true },
  payment_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  payment_is_monthly: { type: DataTypes.BOOLEAN, defaultValue: false },
  payment_monthly_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  insurance: { type: DataTypes.BOOLEAN, allowNull: true },
  desired_keywords: { type: DataTypes.STRING, allowNull: true },
  requirements: { type: DataTypes.JSON, allowNull: true },
}, {
  sequelize: sequelizeInstance,
  tableName: 'job_postings',
  timestamps: true,
  underscored: true,
});

export default JobPosting;