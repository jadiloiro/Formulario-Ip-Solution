"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSubmissionDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_submission_dto_1 = require("./create-submission.dto");
class UpdateSubmissionDto extends (0, mapped_types_1.PartialType)(create_submission_dto_1.CreateSubmissionDto) {
}
exports.UpdateSubmissionDto = UpdateSubmissionDto;
//# sourceMappingURL=update-submission.dto.js.map