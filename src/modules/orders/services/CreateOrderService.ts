import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const checkCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkCustomerExists) {
      throw new AppError('Invalid customer.');
    }

    const listIds = products.map(product => {
      return { id: product.id };
    });

    const productsExistsBD = await this.productsRepository.findAllById(listIds);
    const totalProductsExistsBD = productsExistsBD.length;

    if (totalProductsExistsBD !== products.length) {
      throw new AppError('Invalids Products.');
    }

    const productsInsuficientQuantity = products.filter(
      (product, index) => product.quantity >= productsExistsBD[index].quantity,
    );
    const totalProductsInsuficientQuantity = productsInsuficientQuantity.length;

    if (totalProductsInsuficientQuantity > 0) {
      throw new AppError('Products with insufficient quantities.');
    }

    const order = await this.ordersRepository.create({
      customer: checkCustomerExists,
      products: products.map(product => ({
        product_id: product.id,
        price: productsExistsBD.find(({ id }) => id === product.id)?.price || 0,
        quantity: product.quantity,
      })),
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
