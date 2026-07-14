export type SubmissionStatus = 'rascunho' | 'enviado';
export declare class Submission {
    id: string;
    clientName: string;
    formData: Record<string, unknown> | null;
    flowData: Record<string, unknown> | null;
    status: SubmissionStatus;
    createdAt: Date;
    updatedAt: Date;
}
