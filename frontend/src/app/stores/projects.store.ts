import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { errorKeyOf } from '../core/api/api-error';
import { ProjectsService } from '../core/api/projects.service';
import { CreateProjectRequest, Project, UpdateProjectRequest } from '../models/project.model';

export interface ProjectsState {
  projects: Project[];
  loading: boolean;
  /** Clé i18n de l'erreur de chargement. */
  loadError: string | null;
  adding: boolean;
}

const initialState: ProjectsState = {
  projects: [],
  loading: false,
  loadError: null,
  adding: false,
};

/** État des repos GitLab configurés (RG-003-*) et actions associées. */
export const ProjectsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ProjectsService)) => ({
    /** Charge la liste des repos configurés. */
    async load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const projects = await firstValueFrom(api.getProjects());
        patchState(store, { projects, loading: false });
      } catch (error) {
        patchState(store, { loading: false, loadError: errorKeyOf(error) });
      }
    },

    /**
     * Ajoute un repo (RG-003-01 à RG-003-06, immédiat).
     * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
     */
    async add(request: CreateProjectRequest): Promise<string | null> {
      patchState(store, { adding: true });
      try {
        const project = await firstValueFrom(api.postProject(request));
        patchState(store, { projects: [...store.projects(), project], adding: false });
        return null;
      } catch (error) {
        patchState(store, { adding: false });
        return errorKeyOf(error);
      }
    },

    /**
     * Renomme l'alias d'un repo (RG-003-07, appelé au clic sur « Enregistrer »).
     * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
     */
    async rename(id: number, request: UpdateProjectRequest): Promise<string | null> {
      try {
        const updated = await firstValueFrom(api.putProject(id, request));
        patchState(store, {
          projects: store.projects().map((p) => (p.id === id ? updated : p)),
        });
        return null;
      } catch (error) {
        return errorKeyOf(error);
      }
    },

    /**
     * Supprime un repo (RG-003-08, immédiat).
     * @returns la clé i18n de l'erreur, ou `null` en cas de succès.
     */
    async remove(id: number): Promise<string | null> {
      try {
        await firstValueFrom(api.deleteProject(id));
        patchState(store, { projects: store.projects().filter((p) => p.id !== id) });
        return null;
      } catch (error) {
        return errorKeyOf(error);
      }
    },
  })),
);
