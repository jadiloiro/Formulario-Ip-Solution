"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_entity_1 = require("./entities/submission.entity");
let SubmissionsService = class SubmissionsService {
    constructor(repo) {
        this.repo = repo;
    }
    create(dto) {
        const submission = this.repo.create({ ...dto, status: dto.status ?? 'rascunho' });
        return this.repo.save(submission);
    }
    findAll() {
        return this.repo.find({ order: { updatedAt: 'DESC' } });
    }
    async findOne(id) {
        const submission = await this.repo.findOneBy({ id });
        if (!submission)
            throw new common_1.NotFoundException(`Submissão ${id} não encontrada`);
        return submission;
    }
    async findOrCreateCurrent() {
        const current = await this.repo.findOne({
            where: { status: 'rascunho' },
            order: { updatedAt: 'DESC' },
        });
        if (current)
            return current;
        return this.repo.save(this.repo.create({}));
    }
    async update(id, dto) {
        const submission = await this.findOne(id);
        Object.assign(submission, dto);
        return this.repo.save(submission);
    }
    async updateFlow(id, flowData) {
        const submission = await this.findOne(id);
        submission.flowData = flowData;
        return this.repo.save(submission);
    }
    async submit(id) {
        const submission = await this.findOne(id);
        submission.status = 'enviado';
        return this.repo.save(submission);
    }
    async remove(id) {
        const submission = await this.findOne(id);
        await this.repo.remove(submission);
    }
};
exports.SubmissionsService = SubmissionsService;
exports.SubmissionsService = SubmissionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SubmissionsService);
//# sourceMappingURL=submissions.service.js.map