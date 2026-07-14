import { Repository } from 'typeorm';
import { Submission } from './entities/submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
export declare class SubmissionsService {
    private readonly repo;
    constructor(repo: Repository<Submission>);
    create(dto: CreateSubmissionDto): Promise<Submission>;
    findAll(): Promise<Submission[]>;
    findOne(id: string): Promise<Submission>;
    findOrCreateCurrent(): Promise<Submission>;
    update(id: string, dto: UpdateSubmissionDto): Promise<Submission>;
    updateFlow(id: string, flowData: Record<string, unknown>): Promise<Submission>;
    submit(id: string): Promise<Submission>;
    remove(id: string): Promise<void>;
}
