import { PublicRankingService } from '@placeholder/application/src/stats';
import { Role } from '@placeholder/domain/src/identity';

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
