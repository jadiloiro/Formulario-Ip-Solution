export declare class CreateSubmissionDto {
    clientName?: string;
    formData?: Record<string, unknown>;
    flowData?: Record<string, unknown>;
    status?: 'rascunho' | 'enviado';
}
