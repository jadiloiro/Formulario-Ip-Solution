import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
export declare class SubmissionsController {
    private readonly service;
    constructor(service: SubmissionsService);
    create(dto: CreateSubmissionDto): Promise<import("./entities/submission.entity").Submission>;
    findAll(): Promise<import("./entities/submission.entity").Submission[]>;
    current(): Promise<import("./entities/submission.entity").Submission>;
    findOne(id: string): Promise<import("./entities/submission.entity").Submission>;
    update(id: string, dto: UpdateSubmissionDto): Promise<import("./entities/submission.entity").Submission>;
    updateFlow(id: string, dto: UpdateFlowDto): Promise<import("./entities/submission.entity").Submission>;
    submit(id: string): Promise<import("./entities/submission.entity").Submission>;
    remove(id: string): Promise<void>;
}
