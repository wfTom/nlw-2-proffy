import { Request, Response } from 'express';
import db from '../database/connection';
import convertHourToMinutes from '../utils/convertHourToMinutes';

interface ScheduleItem {
  weekDay: number;
  from: string;
  to: string;
}

export default class ClassesController {
  async index(request: Request, response: Response) {
    console.log('ClassesController-index');
    try {
      const filters = request.query;
      console.log(request.query);

      const subject = filters.subject as string;
      const weekDay = filters.weekDay as string;
      const time = filters.time as string;

      if(!filters.weekDay || !filters.subject || !filters.time) {
        return response.status(400).json({
          error: 'Missing filters to search classes'
        });
      }

      const timeInMinutes = convertHourToMinutes(time);
      console.log(timeInMinutes);


      const classes = await db('classes')
      .whereExists(function() {
        this.select('class_schedule.*')
        .from('class_schedule')
        .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
        .whereRaw('`class_schedule`.`week_day` = ??', [Number(weekDay)])
        // .whereRaw('`class_schedule`.`from` = ??', [timeInMinutes])
        // .whereRaw('`class_schedule`.`to` = ??', [timeInMinutes])
      })
      .where('classes.subject', '=', subject)
      .join('users', 'classes.user_id', '=', 'user_id')
      .select(['classes.*', 'users.*']);

      console.log(classes);

      return response.json(classes);
    } catch (err) {
      console.log(err);
    }
  }

  async create(request: Request, response: Response) {
    console.log('ClassesController-create');

    const {
      name,
      avatar,
      whatsapp,
      bio,
      subject,
      cost,
      schedule,
    } = request.body;

    console.log(request.body);

    const trx = await db.transaction();

    try {
      const insertedUsersIds = await trx('users').insert({
        name,
        avatar,
        whatsapp,
        bio,
      });

      const userId = insertedUsersIds[0];
      const user_id = userId;

      const insertedClassesIds = await trx('classes').insert({
        subject,
        cost,
        user_id,
      });

      const classId = insertedClassesIds[0];
      const class_id = classId;

      const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
        return {
          class_id,
          week_day: scheduleItem.weekDay,
          from: convertHourToMinutes(scheduleItem.from),
          to: convertHourToMinutes(scheduleItem.to),
        };
      });

      await trx('class_schedule').insert(classSchedule);

      await trx.commit();

      return response.status(201).send();
    } catch (err) {
      await trx.rollback();
      console.log(err);
      return response.status(400).json({
        error: 'Unexpected error while creating new class',
      });
    }
  }
}
