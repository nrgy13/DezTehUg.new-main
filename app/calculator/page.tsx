'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, ArrowRight, ArrowLeft, Check, Building, Home, Factory, Warehouse, Building2 } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { CyberpunkProgressBar } from '@/components/cyberpunk/CyberpunkProgressBar';
import AnimatedIcon from '@/components/AnimatedIcon';

type ObjectType = 'residential' | 'office' | 'medical' | 'food' | 'warehouse';
type ServiceType = 'disinfection' | 'pest-control' | 'deratization' | 'water-analysis' | 'fumigation' | 'deserpentation' | 'deodorization' | 'herbicide-treatment';

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
    animationName: 'family.json',
    color: 'text-cyber-blue',
    collectiveDiscountThreshold: 4, // квартир
    collectiveDiscount: 0.2, // 20%
  },
  {
    id: 'office' as ObjectType,
    title: 'Офисные помещения',
    description: 'Торговые и производственные',
    icon: Building,
    animationName: 'building.json',
    color: 'text-electric-blue',
    collectiveDiscountThreshold: 1000, // м²
    collectiveDiscount: 0.15, // 15%
  },
  {
    id: 'medical' as ObjectType,
    title: 'Медицинские учреждения',
    description: 'Госучреждения',
    icon: Building2,
    animationName: 'hospital.json',
    color: 'text-red-500',
  },
  {
    id: 'food' as ObjectType,
    title: 'Пищевые производства',
    description: 'Общепит',
    icon: Factory,
    animationName: 'coffee-shop.json',
    color: 'text-poison-green',
  },
  {
    id: 'warehouse' as ObjectType,
    title: 'Складские помещения',
    description: 'Частный сектор',
    icon: Warehouse,
    animationName: 'warehouse.json',
    color: 'text-neon-orange',
    collectiveDiscountThreshold: 12, // соток (1200 м²)
    collectiveDiscount: 0.15, // 15%
  },
];

const services = [
  {
    id: 'disinfection' as ServiceType,
    title: 'Дезинфекция',
    description: 'Уничтожение вирусов и бактерий',
    duration: '1-3 часа',
  },
  {
    id: 'pest-control' as ServiceType,
    title: 'Дезинсекция',
    description: 'Уничтожение насекомых',
    duration: '2-4 часа',
  },
  {
    id: 'deratization' as ServiceType,
    title: 'Дератизация',
    description: 'Уничтожение грызунов',
    duration: '2-5 часов',
  },
  {
    id: 'water-analysis' as ServiceType,
    title: 'Анализ воды',
    description: 'Лабораторные исследования',
    duration: '24-48 часов',
  },
  {
    id: 'fumigation' as ServiceType,
    title: 'Фумигация',
    description: 'Газовая обработка',
    duration: '4-8 часов',
  },
  {
    id: 'deserpentation' as ServiceType,
    title: 'Десерпентация',
    description: 'Уничтожение змей',
    duration: '2-4 часа',
  },
  {
    id: 'deodorization' as ServiceType,
    title: 'Дезодорация',
    description: 'Устранение запахов',
    duration: '1-3 часа',
  },
  {
    id: 'herbicide-treatment' as ServiceType,
    title: 'Гербицидная обработка',
    description: 'Уничтожение сорняков',
    duration: '2-4 часа',
  },
];

// Ценовая матрица согласно новому прайс-листу
const pricingMatrix: Record<ObjectType, Partial<Record<ServiceType, any>>> = {
  residential: {
    'pest-control': {
      // Дезинсекция для квартир по комнатам
      getRoomPrice: (rooms: number) => {
        if (rooms === 1) return 5000; // 1-комнатная до 50 м²
        if (rooms === 2) return 6000; // 2-комнатная 50-90 м²
        if (rooms >= 3) return 7900; // 3+ комнатная 90-130 м²
        return 5000;
      }
    },
    'deratization': {
      // Дератизация для квартир по комнатам (те же цены что и дезинсекция)
      getRoomPrice: (rooms: number) => {
        if (rooms === 1) return 5000; // 1-комнатная до 50 м²
        if (rooms === 2) return 6000; // 2-комнатная 50-90 м²
        if (rooms >= 3) return 7900; // 3+ комнатная 90-130 м²
        return 5000;
      }
    },
    'disinfection': {
      pricePerSqm: 50 // 50 руб/м²
    }
  },
  office: {
    'pest-control': {
      basePrice: 5450, // до 50 м²
      threshold: 50,
      pricePerSqmOver: 20 // за каждый м² свыше 50
    },
    'deratization': {
      basePrice: 4950, // до 50 м²
      threshold: 50,
      pricePerSqmOver: 20 // за каждый м² свыше 50
    },
    'disinfection': {
      pricePerSqm: 25 // COVID-19: 25 руб/м²
    }
  },
  medical: {
    'pest-control': {
      basePrice: 5450, // до 100 м²
      threshold: 100,
      pricePerSqmOver: 45 // за каждый м² свыше 100
    },
    'deratization': {
      basePrice: 4950, // до 100 м²
      threshold: 100,
      pricePerSqmOver: 45 // за каждый м² свыше 100
    },
    'disinfection': {
      pricePerSqm: 35 // 35 руб/м²
    }
  },
  food: {
    'pest-control': {
      basePrice: 6000, // до 50 м²
      threshold: 50,
      pricePerSqmOver: 50 // за каждый м² свыше 50
    },
    'deratization': {
      basePrice: 5500, // до 50 м²
      threshold: 50,
      pricePerSqmOver: 50 // за каждый м² свыше 50
    },
    'disinfection': {
      pricePerSqm: 25 // COVID-19: 25 руб/м²
    }
  },
  warehouse: {
    'pest-control': {
      basePrice: 5450, // до 100 м²
      threshold: 100,
      pricePerSqmOver: 45 // за каждый м² свыше 100
    },
    'deratization': {
      basePrice: 4950, // до 100 м²
      threshold: 100,
      pricePerSqmOver: 45 // за каждый м² свыше 100
    },
    'disinfection': {
      pricePerSqm: 35 // 35 руб/м²
    }
  }
};

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
  const [hoveredObjectIndex, setHoveredObjectIndex] = useState<number | null>(null);
  
  // Обработчик для touch событий с предотвращением конфликтов
  const handleObjectTouchStart = (index: number) => {
    setHoveredObjectIndex(index);
  };
  
  const handleObjectTouchEnd = () => {
    // Не останавливаем анимацию сразу - даем доиграть до конца цикла
    // Анимация остановится автоматически через useEffect в AnimatedIcon
    // Используем стандартную длительность анимации (обычно 2 секунды)
    setTimeout(() => setHoveredObjectIndex(null), 2000);
  };

  const calculateServicePrice = (serviceId: ServiceType): number => {
    if (!state.objectType) return 0;
    
    const service = services.find(s => s.id === serviceId);
    if (!service) return 0;
    
    // Фиксированная цена для анализа воды - 2500 руб для всех типов объектов
    if (serviceId === 'water-analysis') {
      return 2500;
    }
    
    // Фиксированные цены для новых услуг
    if (serviceId === 'fumigation') {
      return Math.round(state.area * 300); // 300 руб/м²
    }
    if (serviceId === 'deserpentation') {
      return 5000; // Фиксированная цена
    }
    if (serviceId === 'deodorization') {
      return Math.round(state.area * 200); // 200 руб/м²
    }
    if (serviceId === 'herbicide-treatment') {
      return Math.round((state.area / 100) * 150); // 150 руб/сотка
    }
    
    const pricing = pricingMatrix[state.objectType]?.[serviceId];
    if (!pricing) return 0;
    
    // Для жилых помещений дезинсекция и дератизация рассчитываются по комнатам
    if (state.objectType === 'residential' && (serviceId === 'pest-control' || serviceId === 'deratization') && 'getRoomPrice' in pricing) {
      return pricing.getRoomPrice(state.rooms);
    }
    
    // Для услуг с базовой ценой и доплатой за превышение
    if ('basePrice' in pricing && 'threshold' in pricing && 'pricePerSqmOver' in pricing) {
      const { basePrice, threshold, pricePerSqmOver } = pricing;
      if (state.area <= threshold) {
        return basePrice;
      } else {
        return basePrice + (state.area - threshold) * pricePerSqmOver;
      }
    }
    
    // Для услуг с ценой за м²
    if ('pricePerSqm' in pricing) {
      return pricing.pricePerSqm * state.area;
    }
    
    return 0;
  };

  const calculateTotal = () => {
    if (!state.objectType) return 0;
    
    // Базовая стоимость услуг
    const baseTotal = state.services.reduce((sum, serviceId) => {
      return sum + calculateServicePrice(serviceId);
    }, 0);
    
    // Коллективная скидка
    const objectType = objectTypes.find(t => t.id === state.objectType);
    let collectiveDiscount = 1;
    if (objectType?.collectiveDiscountThreshold && objectType?.collectiveDiscount) {
      const threshold = objectType.collectiveDiscountThreshold;
      const checkValue = state.objectType === 'residential' ? state.rooms :
                        state.objectType === 'warehouse' ? state.area / 100 : // соток
                        state.area;
      
      if (checkValue >= threshold) {
        collectiveDiscount = 1 - objectType.collectiveDiscount;
      }
    }
    
    // Комплексная скидка при заказе 3+ услуг: 15%
    const packageDiscount = state.services.length >= 3 ? 0.85 : 1;
    
    // Срочный выезд: +50%
    const urgencyMultiplier = state.urgency ? 1.5 : 1;
    
    const total = baseTotal * collectiveDiscount * packageDiscount * urgencyMultiplier;
    
    // Скидка 6% после ввода данных клиента (шаг 5)
    const finalPrice = total * 0.94;
    
    return Math.round(finalPrice);
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
            <div className="mb-6">
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
                  {objectTypes.map((type, index) => (
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
                        onMouseEnter={() => setHoveredObjectIndex(index)}
                        onMouseLeave={() => setHoveredObjectIndex(null)}
                        onTouchStart={() => handleObjectTouchStart(index)}
                        onTouchEnd={handleObjectTouchEnd}
                      >
                        <div className="text-center">
                          <AnimatedIcon
                            animationName={type.animationName}
                            className={`h-12 w-12 mx-auto mb-4 ${
                              state.objectType === type.id ? 'text-poison-green' : type.color
                            }`}
                            isHovered={hoveredObjectIndex === index}
                          />
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
                              {service.id === 'water-analysis'
                                ? '2 500 ₽'
                                : state.objectType === 'residential' && (service.id === 'pest-control' || service.id === 'deratization')
                                  ? 'от 5 000 ₽'
                                  : state.objectType === 'residential' && service.id === 'disinfection'
                                    ? '50 ₽/м²'
                                    : state.objectType && pricingMatrix[state.objectType]?.[service.id]
                                      ? (() => {
                                          const pricing = pricingMatrix[state.objectType][service.id];
                                          if ('basePrice' in pricing) {
                                            return `от ${pricing.basePrice} ₽`;
                                          } else if ('pricePerSqm' in pricing) {
                                            return `${pricing.pricePerSqm} ₽/м²`;
                                          }
                                          return 'Цена по запросу';
                                        })()
                                      : 'Цена по запросу'
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
                {state.services.length >= 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                  >
                    <CyberpunkCard className="p-4 neon-border">
                      <div className="text-center">
                        <div className="text-lg font-orbitron font-bold text-neon-orange mb-2">
                          🎉 Комплексная скидка!
                        </div>
                        <div className="text-content-secondary">
                          Скидка 15% за заказ от 3 услуг
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
                    
                    const cost = calculateServicePrice(serviceId);
                    
                    // Формируем описание расчета
                    let description = '';
                    if (serviceId === 'water-analysis') {
                      description = 'Фиксированная стоимость';
                    } else if (state.objectType) {
                      const pricing = pricingMatrix[state.objectType]?.[serviceId];
                      if (state.objectType === 'residential' && (serviceId === 'pest-control' || serviceId === 'deratization')) {
                        description = `${state.rooms}-комнатная квартира`;
                      } else if (pricing && 'basePrice' in pricing && 'threshold' in pricing) {
                        const { basePrice, threshold, pricePerSqmOver } = pricing;
                        if (state.area <= threshold) {
                          description = `Базовая цена до ${threshold} м²`;
                        } else {
                          description = `${basePrice} ₽ + ${pricePerSqmOver} ₽/м² × ${state.area - threshold} м²`;
                        }
                      } else if (pricing && 'pricePerSqm' in pricing) {
                        description = `${pricing.pricePerSqm} ₽/м² × ${state.area} м²`;
                      }
                    }
                    
                    return (
                      <div key={serviceId} className="flex justify-between items-center p-4 bg-bg-secondary rounded-lg">
                        <div>
                          <div className="font-medium text-content-primary">{service.title}</div>
                          <div className="text-sm text-content-muted">
                            {description}
                          </div>
                        </div>
                        <div className="text-lg font-orbitron font-bold text-content-primary">
                          {cost.toLocaleString()} ₽
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Коллективная скидка */}
                  {(() => {
                    const objectType = objectTypes.find(t => t.id === state.objectType);
                    if (objectType?.collectiveDiscountThreshold && objectType?.collectiveDiscount) {
                      const threshold = objectType.collectiveDiscountThreshold;
                      const checkValue = state.objectType === 'residential' ? state.rooms :
                                        state.objectType === 'warehouse' ? state.area / 100 : // соток
                                        state.area;
                      
                      if (checkValue >= threshold) {
                        return (
                          <div className="flex justify-between items-center p-4 bg-cyber-blue/10 rounded-lg border border-cyber-blue/30">
                            <div className="text-cyber-blue font-medium">
                              Коллективная скидка
                              {state.objectType === 'residential' && ` (от ${threshold} квартир)`}
                              {state.objectType === 'office' && ` (от ${threshold} м²)`}
                              {state.objectType === 'warehouse' && ` (от ${threshold} соток)`}
                            </div>
                            <div className="text-lg font-orbitron font-bold text-cyber-blue">
                              -{Math.round(objectType.collectiveDiscount * 100)}%
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                  
                  {state.services.length >= 3 && (
                    <div className="flex justify-between items-center p-4 bg-poison-green/10 rounded-lg border border-poison-green/30">
                      <div className="text-poison-green font-medium">
                        Комплексная скидка (3+ услуги)
                      </div>
                      <div className="text-lg font-orbitron font-bold text-poison-green">
                        -15%
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