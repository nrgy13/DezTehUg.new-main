'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, ArrowRight, ArrowLeft, Check, Building, Home, Factory, Warehouse, Building2 } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { CyberpunkProgressBar } from '@/components/cyberpunk/CyberpunkProgressBar';

type ObjectType = 'residential' | 'office' | 'medical' | 'food' | 'warehouse';
type ServiceType = 'disinfection' | 'pest-control' | 'deratization' | 'water-analysis';

interface CalculatorState {
  step: number;
  objectType: ObjectType | null;
  area: number;
  rooms: number;
  floors: number;
  services: ServiceType[];
  urgency: boolean;
  contactInfo: {
    name: string;
    phone: string;
    email: string;
    address: string;
    preferredTime: string;
  };
}

const objectTypes = [
  {
    id: 'residential' as ObjectType,
    title: 'Жилые помещения',
    description: 'Квартиры, дома, коттеджи',
    icon: Home,
    multiplier: 1.0,
  },
  {
    id: 'office' as ObjectType,
    title: 'Офисные помещения',
    description: 'Офисы, коворкинги, БЦ',
    icon: Building,
    multiplier: 1.2,
  },
  {
    id: 'medical' as ObjectType,
    title: 'Медицинские учреждения',
    description: 'Клиники, больницы, лаборатории',
    icon: Building2,
    multiplier: 1.8,
  },
  {
    id: 'food' as ObjectType,
    title: 'Пищевые производства',
    description: 'Рестораны, кафе, пекарни',
    icon: Factory,
    multiplier: 1.5,
  },
  {
    id: 'warehouse' as ObjectType,
    title: 'Складские помещения',
    description: 'Склады, логистические центры',
    icon: Warehouse,
    multiplier: 0.8,
  },
];

const services = [
  {
    id: 'disinfection' as ServiceType,
    title: 'Дезинфекция',
    description: 'Уничтожение вирусов и бактерий',
    basePrice: 150,
    duration: '1-3 часа',
  },
  {
    id: 'pest-control' as ServiceType,
    title: 'Дезинсекция',
    description: 'Уничтожение насекомых',
    basePrice: 200,
    duration: '2-4 часа',
  },
  {
    id: 'deratization' as ServiceType,
    title: 'Дератизация',
    description: 'Уничтожение грызунов',
    basePrice: 250,
    duration: '2-5 часов',
  },
  {
    id: 'water-analysis' as ServiceType,
    title: 'Анализ воды',
    description: 'Лабораторные исследования',
    basePrice: 2500,
    duration: '24-48 часов',
    isFixed: true,
  },
];

export default function CalculatorPage() {
  const [state, setState] = useState<CalculatorState>({
    step: 1,
    objectType: null,
    area: 50,
    rooms: 2,
    floors: 1,
    services: [],
    urgency: false,
    contactInfo: {
      name: '',
      phone: '',
      email: '',
      address: '',
      preferredTime: '',
    },
  });

  const calculateTotal = () => {
    if (!state.objectType) return 0;
    
    const objectMultiplier = objectTypes.find(t => t.id === state.objectType)?.multiplier || 1;
    const urgencyMultiplier = state.urgency ? 1.5 : 1;
    const packageDiscount = state.services.length >= 3 ? 0.85 : state.services.length >= 2 ? 0.95 : 1;
    
    const total = state.services.reduce((sum, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      if (!service) return sum;
      
      if (service.isFixed) {
        return sum + service.basePrice;
      }
      
      return sum + (service.basePrice * state.area * objectMultiplier);
    }, 0);
    
    return Math.round(total * urgencyMultiplier * packageDiscount);
  };

  const nextStep = () => {
    if (state.step < 5) {
      setState(prev => ({ ...prev, step: prev.step + 1 }));
    }
  };

  const prevStep = () => {
    if (state.step > 1) {
      setState(prev => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const selectObjectType = (type: ObjectType) => {
    setState(prev => ({ ...prev, objectType: type }));
  };

  const toggleService = (serviceId: ServiceType) => {
    setState(prev => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter(s => s !== serviceId)
        : [...prev.services, serviceId]
    }));
  };

  const updateContactInfo = (field: string, value: string) => {
    setState(prev => ({
      ...prev,
      contactInfo: { ...prev.contactInfo, [field]: value }
    }));
  };

  return (
    <div className="min-h-screen pt-24 bg-bg-secondary">
      {/* Header */}
      <section className="py-12 bg-gradient-to-r from-bg-primary to-bg-secondary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-6"
          >
            <div className="flex items-center justify-center space-x-3 mb-6">
              <Calculator className="h-8 w-8 text-poison-green" />
              <h1 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary">
                Точный расчет стоимости за{' '}
                <span className="text-poison-green">3 минуты</span>
              </h1>
            </div>
            <p className="text-xl text-content-secondary max-w-2xl mx-auto">
              Честные цены без накруток. Получите детальную смету с расшифровкой каждой позиции 
              и возможностью сэкономить до 25% при комплексных заказах.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CyberpunkProgressBar 
          value={state.step} 
          max={5} 
          showPercentage={false}
          className="mb-8"
        />
        <div className="text-center text-sm text-content-muted">
          Шаг {state.step} из 5
        </div>
      </div>

      {/* Calculator Steps */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <AnimatePresence mode="wait">
          {/* Step 1: Object Type */}
          {state.step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
            >
              <CyberpunkCard className="p-8">
                <h2 className="text-2xl font-orbitron font-bold text-content-primary mb-6 text-center">
                  Какой объект нужно обработать?
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {objectTypes.map((type) => (
                    <motion.div
                      key={type.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <CyberpunkCard
                        className={`p-6 cursor-pointer transition-all duration-300 ${
                          state.objectType === type.id
                            ? 'poison-border bg-poison-green/5'
                            : 'hover:border-poison-green/50'
                        }`}
                        onClick={() => selectObjectType(type.id)}
                      >
                        <div className="text-center">
                          <type.icon className={`h-12 w-12 mx-auto mb-4 ${
                            state.objectType === type.id ? 'text-poison-green' : 'text-content-secondary'
                          }`} />
                          <h3 className="font-orbitron font-semibold text-content-primary mb-2">
                            {type.title}
                          </h3>
                          <p className="text-sm text-content-muted">
                            {type.description}
                          </p>
                          {state.objectType === type.id && (
                            <div className="mt-3">
                              <Check className="h-6 w-6 text-poison-green mx-auto" />
                            </div>
                          )}
                        </div>
                      </CyberpunkCard>
                    </motion.div>
                  ))}
                </div>
                
                <div className="flex justify-end">
                  <CyberpunkButton
                    onClick={nextStep}
                    disabled={!state.objectType}
                    variant="primary"
                    size="lg"
                  >
                    Далее
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </CyberpunkButton>
                </div>
              </CyberpunkCard>
            </motion.div>
          )}

          {/* Step 2: Object Parameters */}
          {state.step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
            >
              <CyberpunkCard className="p-8">
                <h2 className="text-2xl font-orbitron font-bold text-content-primary mb-6 text-center">
                  Уточните характеристики объекта
                </h2>
                
                <div className="space-y-6 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-content-primary mb-2">
                      Площадь обработки (м²)
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        min="10"
                        max="1000"
                        value={state.area}
                        onChange={(e) => setState(prev => ({ ...prev, area: parseInt(e.target.value) }))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <NeonInput
                        type="number"
                        value={state.area}
                        onChange={(e) => setState(prev => ({ ...prev, area: parseInt(e.target.value) }))}
                        className="w-24"
                        min="10"
                        max="1000"
                      />
                    </div>
                    <div className="text-sm text-content-muted mt-1">
                      Выберите от 10 до 1000 м²
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-content-primary mb-2">
                        Количество комнат
                      </label>
                      <NeonInput
                        type="number"
                        value={state.rooms}
                        onChange={(e) => setState(prev => ({ ...prev, rooms: parseInt(e.target.value) }))}
                        min="1"
                        max="50"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-content-primary mb-2">
                        Количество этажей
                      </label>
                      <NeonInput
                        type="number"
                        value={state.floors}
                        onChange={(e) => setState(prev => ({ ...prev, floors: parseInt(e.target.value) }))}
                        min="1"
                        max="20"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <CyberpunkButton
                    onClick={prevStep}
                    variant="outline"
                    size="lg"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Назад
                  </CyberpunkButton>
                  <CyberpunkButton
                    onClick={nextStep}
                    variant="primary"
                    size="lg"
                  >
                    Далее
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </CyberpunkButton>
                </div>
              </CyberpunkCard>
            </motion.div>
          )}

          {/* Step 3: Services */}
          {state.step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
            >
              <CyberpunkCard className="p-8">
                <h2 className="text-2xl font-orbitron font-bold text-content-primary mb-6 text-center">
                  Какие угрозы нужно ликвидировать?
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {services.map((service) => (
                    <motion.div
                      key={service.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <CyberpunkCard
                        className={`p-6 cursor-pointer transition-all duration-300 ${
                          state.services.includes(service.id)
                            ? 'poison-border bg-poison-green/5'
                            : 'hover:border-poison-green/50'
                        }`}
                        onClick={() => toggleService(service.id)}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-orbitron font-semibold text-content-primary">
                            {service.title}
                          </h3>
                          {state.services.includes(service.id) && (
                            <Check className="h-6 w-6 text-poison-green" />
                          )}
                        </div>
                        
                        <p className="text-sm text-content-muted mb-4">
                          {service.description}
                        </p>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-sm">
                            <div className="font-medium text-poison-green">
                              {service.isFixed 
                                ? `${service.basePrice} ₽`
                                : `от ${service.basePrice} ₽/м²`
                              }
                            </div>
                            <div className="text-content-muted">
                              {service.duration}
                            </div>
                          </div>
                        </div>
                      </CyberpunkCard>
                    </motion.div>
                  ))}
                </div>
                
                {/* Package Deals */}
                {state.services.length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                  >
                    <CyberpunkCard className="p-4 neon-border">
                      <div className="text-center">
                        <div className="text-lg font-orbitron font-bold text-neon-orange mb-2">
                          🎉 Скидка на комплексные услуги!
                        </div>
                        <div className="text-content-secondary">
                          {state.services.length >= 3 
                            ? 'Скидка 15% за заказ от 3 услуг'
                            : 'Скидка 5% за заказ от 2 услуг'
                          }
                        </div>
                      </div>
                    </CyberpunkCard>
                  </motion.div>
                )}
                
                {/* Urgency */}
                <div className="mb-8">
                  <CyberpunkCard 
                    className={`p-4 cursor-pointer transition-all duration-300 ${
                      state.urgency ? 'neon-border bg-neon-orange/5' : 'hover:border-neon-orange/50'
                    }`}
                    onClick={() => setState(prev => ({ ...prev, urgency: !prev.urgency }))}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-orbitron font-semibold text-content-primary">
                          Срочный выезд (в течение 2 часов)
                        </h3>
                        <p className="text-sm text-content-muted">
                          Доплата 50% к стоимости услуг
                        </p>
                      </div>
                      {state.urgency && (
                        <Check className="h-6 w-6 text-neon-orange" />
                      )}
                    </div>
                  </CyberpunkCard>
                </div>
                
                <div className="flex justify-between">
                  <CyberpunkButton
                    onClick={prevStep}
                    variant="outline"
                    size="lg"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Назад
                  </CyberpunkButton>
                  <CyberpunkButton
                    onClick={nextStep}
                    disabled={state.services.length === 0}
                    variant="primary"
                    size="lg"
                  >
                    Далее
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </CyberpunkButton>
                </div>
              </CyberpunkCard>
            </motion.div>
          )}

          {/* Step 4: Contact Info */}
          {state.step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
            >
              <CyberpunkCard className="p-8">
                <h2 className="text-2xl font-orbitron font-bold text-content-primary mb-6 text-center">
                  Как с вами связаться?
                </h2>
                
                <div className="space-y-6 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-content-primary mb-2">
                        Ваше имя *
                      </label>
                      <NeonInput
                        type="text"
                        value={state.contactInfo.name}
                        onChange={(e) => updateContactInfo('name', e.target.value)}
                        placeholder="Введите ваше имя"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-content-primary mb-2">
                        Телефон *
                      </label>
                      <NeonInput
                        type="tel"
                        value={state.contactInfo.phone}
                        onChange={(e) => updateContactInfo('phone', e.target.value)}
                        placeholder="+7 (XXX) XXX-XX-XX"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-content-primary mb-2">
                        Email
                      </label>
                      <NeonInput
                        type="email"
                        value={state.contactInfo.email}
                        onChange={(e) => updateContactInfo('email', e.target.value)}
                        placeholder="your@email.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-content-primary mb-2">
                        Удобное время звонка
                      </label>
                      <select
                        value={state.contactInfo.preferredTime}
                        onChange={(e) => updateContactInfo('preferredTime', e.target.value)}
                        className="w-full h-11 rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 transition-all duration-300"
                      >
                        <option value="">Выберите время</option>
                        <option value="morning">Утром (9:00-12:00)</option>
                        <option value="afternoon">Днем (12:00-15:00)</option>
                        <option value="evening">Вечером (15:00-18:00)</option>
                        <option value="anytime">Любое время</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-content-primary mb-2">
                      Адрес объекта
                    </label>
                    <NeonInput
                      type="text"
                      value={state.contactInfo.address}
                      onChange={(e) => updateContactInfo('address', e.target.value)}
                      placeholder="Укажите адрес для выезда специалиста"
                    />
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <CyberpunkButton
                    onClick={prevStep}
                    variant="outline"
                    size="lg"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Назад
                  </CyberpunkButton>
                  <CyberpunkButton
                    onClick={nextStep}
                    disabled={!state.contactInfo.name || !state.contactInfo.phone}
                    variant="primary"
                    size="lg"
                  >
                    Получить расчет
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </CyberpunkButton>
                </div>
              </CyberpunkCard>
            </motion.div>
          )}

          {/* Step 5: Results */}
          {state.step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
            >
              <CyberpunkCard className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-orbitron font-bold text-content-primary mb-4">
                    Ваша персональная смета готова!
                  </h2>
                  <div className="text-4xl font-orbitron font-bold text-poison-green mb-2">
                    {calculateTotal().toLocaleString()} ₽
                  </div>
                  <p className="text-content-secondary">
                    Итоговая стоимость услуг
                  </p>
                </div>
                
                {/* Breakdown */}
                <div className="space-y-4 mb-8">
                  <h3 className="text-lg font-orbitron font-semibold text-content-primary">
                    Детализация расчета:
                  </h3>
                  
                  {state.services.map((serviceId) => {
                    const service = services.find(s => s.id === serviceId);
                    if (!service) return null;
                    
                    const objectMultiplier = objectTypes.find(t => t.id === state.objectType)?.multiplier || 1;
                    const cost = service.isFixed 
                      ? service.basePrice
                      : service.basePrice * state.area * objectMultiplier;
                    
                    return (
                      <div key={serviceId} className="flex justify-between items-center p-4 bg-bg-secondary rounded-lg">
                        <div>
                          <div className="font-medium text-content-primary">{service.title}</div>
                          <div className="text-sm text-content-muted">
                            {service.isFixed 
                              ? 'Фиксированная стоимость'
                              : `${service.basePrice} ₽/м² × ${state.area} м² × ${objectMultiplier}`
                            }
                          </div>
                        </div>
                        <div className="text-lg font-orbitron font-bold text-content-primary">
                          {cost.toLocaleString()} ₽
                        </div>
                      </div>
                    );
                  })}
                  
                  {state.services.length >= 2 && (
                    <div className="flex justify-between items-center p-4 bg-poison-green/10 rounded-lg border border-poison-green/30">
                      <div className="text-poison-green font-medium">
                        Скидка на комплексные услуги
                      </div>
                      <div className="text-lg font-orbitron font-bold text-poison-green">
                        -{state.services.length >= 3 ? '15%' : '5%'}
                      </div>
                    </div>
                  )}
                  
                  {state.urgency && (
                    <div className="flex justify-between items-center p-4 bg-neon-orange/10 rounded-lg border border-neon-orange/30">
                      <div className="text-neon-orange font-medium">
                        Срочный выезд
                      </div>
                      <div className="text-lg font-orbitron font-bold text-neon-orange">
                        +50%
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Timeline */}
                <div className="mb-8 p-4 bg-bg-secondary rounded-lg">
                  <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-2">
                    Время выполнения:
                  </h3>
                  <div className="text-2xl font-orbitron font-bold text-cyber-blue">
                    {state.urgency ? '2 часа' : '24 часа'}
                  </div>
                  <div className="text-sm text-content-muted">
                    {state.urgency ? 'Экстренный выезд' : 'Стандартный выезд'}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="space-y-4">
                  <CyberpunkButton
                    variant="primary"
                    size="lg"
                    className="w-full pulse-cta"
                    onClick={() => alert('Функция заказа услуг будет реализована в следующей версии')}
                  >
                    Заказать услуги
                  </CyberpunkButton>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CyberpunkButton
                      variant="secondary"
                      size="default"
                      className="w-full"
                      onClick={() => alert('Функция отправки на email будет реализована в следующей версии')}
                    >
                      Отправить на email
                    </CyberpunkButton>
                    
                    <CyberpunkButton
                      variant="outline"
                      size="default"
                      className="w-full"
                      href="/contact"
                    >
                      Получить консультацию
                    </CyberpunkButton>
                  </div>
                  
                  <div className="flex justify-center">
                    <CyberpunkButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setState(prev => ({ ...prev, step: 1 }))}
                    >
                      Пересчитать заново
                    </CyberpunkButton>
                  </div>
                </div>
              </CyberpunkCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}