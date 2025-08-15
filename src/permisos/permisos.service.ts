import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { Permisos } from 'src/entities/Permisos';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UsuarioPermisos } from 'src/entities/UsuarioPermisos';

@Injectable()
export class PermisosService {
  constructor(@InjectRepository(Permisos) private readonly permisoRepository: Repository<Permisos>, @InjectRepository(UsuarioPermisos) private readonly usuarioPermiso:Repository<UsuarioPermisos>) { }


  async findAll(page: number = 1, limit: number = 10) {
    const [permisos, total] = await this.permisoRepository.findAndCount({
      relations: ['modulo'],
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: permisos,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findAllList(page: number = 1, limit: number = 10) {
    const permisos = await this.permisoRepository.find({
      relations: ['modulo'],

    });

    return permisos;
  }


  async findOne(id: number) {
    const permiso = await this.permisoRepository.findOne({ where: { id: id } });
    if (!permiso) throw new NotFoundException('Permiso no encontrado');
    return permiso;
  }
   async createPermiso(createPermiso:Permisos, idUsuario){
    try {
      const create = this.permisoRepository.create(createPermiso);
      const savedPermiso = await this.permisoRepository.save(create);
      const asignar = {
        idPermiso: savedPermiso.id,
        idUsuario: idUsuario
      }
      const permiso = await this.usuarioPermiso.create(asignar);
      const asignarRoot = {
        idPermiso: savedPermiso.id,
        idUsuario: 24
      }
      const permisoRoot = await this.usuarioPermiso.create(asignarRoot);
      this.usuarioPermiso.save(permisoRoot);

    } catch (error) {
      return error;
    }
  }

  async update(updatePermiso: UpdatePermisoDto) {
    try {
            const id=updatePermiso.id;
            const permisoActualizar = {
              nombre:updatePermiso.nombre,
              idModulo:updatePermiso.idModulo,
              descripcion:updatePermiso.descripcion
            }
            const permiso = this.permisoRepository.findOne({where:{id}});
            if(!permiso) throw new NotFoundException('Permiso no encontrado')
            const result = this.permisoRepository.update(id,permisoActualizar);
     
            return result;
        } catch (error) {
            return error;
        }
  }

  async remove(id: number) {
    return `This action removes a #${id} permiso`;
  }

   async obtenerPermisosAgrupados(idUsuario): Promise<any[]> {
        try {
          // Consulta SQL cruda
          const query = `
            SELECT 
            DISTINCT UsuarioPermisos.IdPermiso,
              CatModulos.Id AS IdModulo,
              CatModulos.Nombre AS NombreModulo,
              Permisos.Id AS PermisoId,
              Permisos.Nombre AS PermisoNombre,
              Permisos.Descripcion AS PermisoDescripcion
            FROM 
           UsuarioPermisos
            INNER JOIN 
              Permisos ON UsuarioPermisos.IdPermiso = Permisos.Id
            INNER JOIN 
              CatModulos ON Permisos.IdModulo = CatModulos.Id
            WHERE 
              UsuarioPermisos.IdUsuario ='${idUsuario}'`;
    
          // Ejecutar la consulta
          const results = await this.permisoRepository.query(query);
    
          if (!Array.isArray(results)) {
            throw new Error('El resultado de la consulta no es un array');
          }
    
          // Agrupar resultados
          const permisosAgrupados = results.reduce((result, item) => {
            let moduloExistente = result.find(mod => mod.IdModulo === item.IdModulo);
    
            if (!moduloExistente) {
              moduloExistente = {
                IdModulo: item.IdModulo,
                NombreModulo: item.NombreModulo,
                Permisos: []
              };
              result.push(moduloExistente);
            }
    
            moduloExistente.Permisos.push({
              Id: item.PermisoId,
              Nombre: item.PermisoNombre,
              Descripcion: item.PermisoDescripcion
            });
    
            return result;
          }, []);
    
          return permisosAgrupados;
        } catch (error) {
          console.error('Error al obtener permisos agrupados:', error);
          throw error; // Lanzar el error para manejarlo en la capa superior si es necesario
        }
      }
}
