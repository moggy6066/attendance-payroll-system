import { Schema, model, Document } from 'mongoose';

export interface IEmployee extends Document {
    employeeId: string;
    name: string;
    email: string;
    department: string;
    position: string;
    joiningDate: Date;
}

const employeeSchema = new Schema<IEmployee>({
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    department: { type: String, required: true },
    position: { type: String, required: true },
    joiningDate: { type: Date, default: Date.now }
}, { timestamps: true });

export const Employee = model<IEmployee>('Employee', employeeSchema);
