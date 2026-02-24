import { PublicRankingService } from '@packages/application/src/stats';
import { Role } from '@packages/domain/src/identity';

type StudentActor = {
  actorRoles: readonly Role[];
};

export function createRankingRoutes(service: PublicRankingService) {
  return {
    async getPublicRanking(request: StudentActor) {
      if (!request.actorRoles.includes(Role.STUDENT)) {
        throw new Error('Forbidden');
      }
      return service.getPublicRanking();
    }
  };
}
