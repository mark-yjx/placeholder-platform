import { PublicStatsService } from '@packages/application/src/stats';
import { Role } from '@packages/domain/src/identity';

type StudentActor = {
  actorRoles: readonly Role[];
};

export function createStatsRoutes(service: PublicStatsService) {
  return {
    async getPublicStats(request: StudentActor) {
      if (!request.actorRoles.includes(Role.STUDENT)) {
        throw new Error('Forbidden');
      }
      return service.getPublicStats();
    }
  };
}
