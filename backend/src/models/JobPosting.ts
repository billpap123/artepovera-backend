// src/models/JobPosting.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelizeInstance from '../config/db';
import Employer from './Employer';

// This interface defines all the properties a JobPosting instance will have
export interface JobPostingAttributes {
  job_id: number;
  employer_id: number;
  title: string;
  category: string;
  description?: string | null;
  location?: string | null;
  presence: 'Physical' | 'Online' | 'Both';
  start_date?: string | null;
  end_date?: string | null;
  application_deadline?: string | null;
  payment_total: number;
  payment_is_monthly?: boolean;
  payment_monthly_amount?: number | null;
  number_of_months?: number | null; // <-- 1. ADDED HERE
  insurance?: boolean | null;
  desired_keywords?: string | null;
  requirements?: object | null;
  employer?: Employer;
}

// Defines which attributes are optional when creating a new instance
interface JobPostingCreationAttributes extends Optional<JobPostingAttributes, 'job_id'> {}

class JobPosting extends Model<JobPostingAttributes, JobPostingCreationAttributes> implements JobPostingAttributes {
  // Database columns
  public job_id!: number;
  public employer_id!: number;
  public title!: string;
  public category!: string;
  public description!: string | null;
  public location!: string | null;
  public presence!: 'Physical' | 'Online' | 'Both';
  public start_date!: string | null;
  public end_date!: string | null;
  public application_deadline!: string | null;
  public payment_total!: number;
  public payment_is_monthly!: boolean;
  public payment_monthly_amount!: number | null;
  public number_of_months!: number | null; // <-- 2. ADDED HERE
  public insurance!: boolean | null;
  public desired_keywords!: string | null;
  public requirements!: object | null;

  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Association property
  public readonly employer?: Employer;
}

JobPosting.init({
    job_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    employer_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'employers', key: 'employer_id' },
    },
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
    number_of_months: { // <-- 3. ADDED THIS DEFINITION
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    insurance: { type: DataTypes.BOOLEAN, allowNull: true },
    desired_keywords: { type: DataTypes.TEXT, allowNull: true },
    requirements: { type: DataTypes.JSON, allowNull: true },
}, {
  sequelize: sequelizeInstance,
  tableName: 'job_postings',
  timestamps: true,
  underscored: true,
});

export default JobPosting;
