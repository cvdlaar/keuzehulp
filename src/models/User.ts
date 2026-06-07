import mongoose, { Schema, Document } from 'mongoose'

export type UserRole = 'user' | 'keyuser' | 'admin'

export interface IUser extends Document {
  name: string
  email: string
  passwordHash: string
  role: UserRole
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'keyuser', 'admin'], default: 'user' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
