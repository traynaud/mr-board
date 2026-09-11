import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

/** REST facade of the configured GitLab repositories. */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /** `GET /api/v1/projects` */
  @Get()
  list(): Promise<ProjectResponseDto[]> {
    return this.projectsService.list();
  }

  /** `POST /api/v1/projects` */
  @Post()
  add(@Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.projectsService.add(dto);
  }

  /** `PUT /api/v1/projects/:id` */
  @Put(':id')
  rename(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.rename(id, dto);
  }

  /** `DELETE /api/v1/projects/:id` */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.projectsService.remove(id);
  }
}
