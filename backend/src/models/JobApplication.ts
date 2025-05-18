// src/models/JobApplication.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import sequelize from '../config/db';
// Import other models if you define associations here directly
// import JobPosting from './JobPosting';
// import User from './User';

interface JobApplicationAttributes {
  application_id: number;
  job_id: number;
  artist_user_id: number; // User ID of the applying artist
  status: 'pending' | 'viewed' | 'shortlisted' | 'rejected' | 'hired';
  application_date: Date;
  created_at?: Date;
  updated_at?: Date;
}

interface JobApplicationCreationAttributes extends Optional<JobApplicationAttributes, 'application_id' | 'status' | 'application_date' | 'created_at' | 'updated_at'> {}

class JobApplication extends Model<JobApplicationAttributes, JobApplicationCreationAttributes> implements JobApplicationAttributes {
  public application_id!: number;
  public job_id!: number;
  public artist_user_id!: number;
  public status!: 'pending' | 'viewed' | 'shortlisted' | 'rejected' | 'hired';
  public application_date!: Date;

  public readonly created_at!: Date;
  public readonly updatedAt!: Date;

  // Define associations here or (preferably) in a central associations.ts file
  // public readonly jobPosting?: JobPosting;
  // public readonly applyingArtist?: User;
}

JobApplication.init(
  {
    application_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    job_id: {
      type: DataTypes.INTEGER.UNSIGNED, // Match the type in your job_postings table (INT or INT UNSIGNED)
      allowNull: false,
      references: { model: 'job_postings', key: 'job_id' }
    },
    artist_user_id: { // Stores the User ID of the artist
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'user_id' }
    },
    status: {
      type: DataTypes.ENUM('pending', 'viewed', 'shortlisted', 'rejected', 'hired'),
      allowNull: false,
      defaultValue: 'pending',
    },
    application_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    }
  },
  {
    sequelize,
    tableName: 'job_applications',
    timestamps: true,
    underscored: true, // For created_at and updated_at columns
  }
);

export default JobApplication;