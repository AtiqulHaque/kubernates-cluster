import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './note.entity';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService implements OnModuleInit {
  constructor(
    @InjectRepository(Note)
    private readonly notesRepository: Repository<Note>,
  ) {}

  async onModuleInit() {
    await this.notesRepository.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  findAll() {
    return this.notesRepository.find({ order: { id: 'DESC' } });
  }

  async findOne(id: number) {
    const note = await this.notesRepository.findOne({ where: { id } });
    if (!note) {
      throw new NotFoundException(`Note #${id} not found`);
    }
    return note;
  }

  create(dto: CreateNoteDto) {
    this.validate(dto.title, dto.content);
    const note = this.notesRepository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
    });
    return this.notesRepository.save(note);
  }

  async update(id: number, dto: UpdateNoteDto) {
    const note = await this.findOne(id);
    const title = dto.title !== undefined ? dto.title : note.title;
    const content = dto.content !== undefined ? dto.content : note.content;
    this.validate(title, content);
    note.title = title.trim();
    note.content = content.trim();
    return this.notesRepository.save(note);
  }

  async remove(id: number) {
    const note = await this.findOne(id);
    await this.notesRepository.remove(note);
    return { deleted: true, id };
  }

  private validate(title: string, content: string) {
    if (!title || !title.trim()) {
      throw new BadRequestException('Title is required');
    }
    if (!content || !content.trim()) {
      throw new BadRequestException('Content is required');
    }
  }
}
