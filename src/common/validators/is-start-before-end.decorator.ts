import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsStartBeforeEnd(
  startKey: string,
  endKey: string,
  validationOptions?: ValidationOptions,
) {
  return function (constructor: Function) {
    registerDecorator({
      name: 'IsStartBeforeEnd',
      target: constructor,
      propertyName: undefined as any, // หรือ '' ก็ได้ แต่ไม่ใช้จริง
      constraints: [startKey, endKey],
      options: validationOptions,
      validator: {
        validate(_: any, args: ValidationArguments) {
          const [startField, endField] = args.constraints;
          const obj = args.object as any;
          const start = obj[startField];
          const end = obj[endField];
          if (!start || !end) return true;
          return new Date(start) <= new Date(end);
        },
        defaultMessage(args: ValidationArguments) {
          const [startField, endField] = args.constraints;
          return `${startField} must be before or equal to ${endField}`;
        },
      },
    });
  };
}
