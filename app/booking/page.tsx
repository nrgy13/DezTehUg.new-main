'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Building, Home, Factory, Warehouse, Building2, Send } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { CyberpunkProgressBar } from '@/components/cyberpunk/CyberpunkProgressBar';
import AnimatedIcon from '@/components/AnimatedIcon';

type ObjectType = 'residential' | 'office' | 'medical' | 'food' | 'warehouse';
type ServiceType = 'disinfection' | 'pest-control' | 'deratization' | 'water-analysis' | 'fumigation' | 'deserpentation' | 'deodorization' | 'herbicide-treatment';

interface BookingState {
  step: number;
  service: ServiceType | null;
  objectType: ObjectType | null;
  contactInfo: {
    name: string;
    phone: string;
    email: string;
    address: string;
    preferredTime: string;
    message: string;
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
  },
  {
    id: 'office' as ObjectType,
    title: 'Офисные помещения',
    description: 'Торговые и производственные',
    icon: Building,
    animationName: 'building.json',
    color: 'text-electric-blue',
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
  },
];

const services = [
  {
    id: 'disinfection' as ServiceType,
    title: 'Дезинфекция',
    description: 'Уничтожение вирусов и бактерий',
    duration: '30 минут - 1,5 часа',
    animationName: 'antibiotic.json',
  },
  {
    id: 'pest-control' as ServiceType,
    title: 'Дезинсекция',
    description: 'Уничтожение насекомых',
    duration: '30 минут - 1,5 часа',
    animationName: 'insect.json',
  },
  {
    id: 'deratization' as ServiceType,
    title: 'Дератизация',
    description: 'Уничтожение грызунов',
    duration: '30 минут - 1,5 часа',
    animationName: 'mouse.json',
  },
  {
    id: 'water-analysis' as ServiceType,
    title: 'Анализ воды',
    description: 'Лабораторные исследования',
    duration: '24-48 часов',
    animationName: 'microscope.json',
  },
  {
    id: 'fumigation' as ServiceType,
    title: 'Фумигация',
    description: 'Газовая обработка',
    duration: '30 минут - 1,5 часа',
    animationName: 'spray-bottle.json',
  },
  {
    id: 'deserpentation' as ServiceType,
    title: 'Десерпентация',
    description: 'Уничтожение змей',
    duration: '1 час - 2,5 часа',
    animationName: 'snake.json',
  },
  {
    id: 'deodorization' as ServiceType,
    title: 'Дезодорация',
    description: 'Устранение запахов',
    duration: '30 минут - 1,5 часа',
    animationName: 'fresh.json',
  },
  {
    id: 'herbicide-treatment' as ServiceType,
    title: 'Гербицидная обработка',
    description: 'Уничтожение сорняков',
    duration: '2-4 часа',
    animationName: 'grass.json',
  },
];

const serviceIdToSlug: Record<ServiceType, string> = {
  'disinfection': 'disinfection',
  'pest-control': 'pest-control',
  'deratization': 'deratization',
  'water-analysis': 'water-analysis',
  'fumigation': 'fumigation',
  'deserpentation': 'deserpentation',
  'deodorization': 'deodorization',
  'herbicide-treatment': 'herbicide-treatment',
};

export default function BookingPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<BookingState>({
    step: 1,
    service: null,
    objectType: null,
    contactInfo: {
      name: '',
      phone: '',
      email: '',
      address: '',
      preferredTime: '',
      message: '',
    },
  });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [objectHoveredIndex, setObjectHoveredIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Инициализация из query параметров
  useEffect(() => {
    const serviceParam = searchParams.get('service');
    const objectTypeParam = searchParams.get('objectType');
    
    if (serviceParam) {
      const service = Object.keys(serviceIdToSlug).find(
        key => serviceIdToSlug[key as ServiceType] === serviceParam
      ) as ServiceType | undefined;
      if (service) {
        setState(prev => ({ ...prev, service, step: objectTypeParam ? 2 : 1 }));
      }
    }
    
    if (objectTypeParam && ['residential', 'office', 'medical', 'food', 'warehouse'].includes(objectTypeParam)) {
      setState(prev => ({ 
        ...prev, 
        objectType: objectTypeParam as ObjectType,
        step: prev.service ? 3 : 2
      }));
    }
  }, [searchParams]);

  const nextStep = () => {
    if (state.step < 3) {
      setState(prev => ({ ...prev, step: prev.step + 1 }));
    }
  };

  const prevStep = () => {
    if (state.step > 1) {
      setState(prev => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const selectService = (serviceId: ServiceType) => {
    setState(prev => ({ ...prev, service: serviceId }));
  };

  const selectObjectType = (type: ObjectType) => {
    setState(prev => ({ ...prev, objectType: type }));
  };

  const updateContactInfo = (field: string, value: string) => {
    setState(prev => ({
      ...prev,
      contactInfo: { ...prev.contactInfo, [field]: value }
    }));
  };

  const handleSubmit = async () => {
    if (!state.service || !state.objectType || !state.contactInfo.name || !state.contactInfo.phone) {
      setSubmitError('Пожалуйста, заполните все обязательные поля');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: services.find(s => s.id === state.service)?.title || '',
          objectType: objectTypes.find(t => t.id === state.objectType)?.title || '',
          name: state.contactInfo.name,
          phone: state.contactInfo.phone,
          email: state.contactInfo.email,
          address: state.contactInfo.address,
          preferredTime: state.contactInfo.preferredTime,
          message: state.contactInfo.message,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при отправке заявки');
      }

      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError('Произошла ошибка при отправке заявки. Пожалуйста, попробуйте позже или свяжитесь с нами по телефону.');
      console.error('Booking submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleServiceTouchStart = (index: number) => {
    setHoveredIndex(index);
  };

  const handleServiceTouchEnd = () => {
    setTimeout(() => setHoveredIndex(null), 2000);
  };

  const handleObjectTouchStart = (index: number) => {
    setObjectHoveredIndex(index);
  };

  const handleObjectTouchEnd = () => {
    setTimeout(() => setObjectHoveredIndex(null), 2000);
  };

  if (submitSuccess) {
    return (
      <div className="min-h-screen pt-24 bg-bg-secondary flex items-center justify-center">
        <CyberpunkCard className="p-8 max-w-2xl mx-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-3xl font-orbitron font-bold text-content-primary">
              Заявка успешно отправлена!
            </h2>
            <p className="text-lg text-content-secondary leading-relaxed">
              Наш менеджер свяжется с вами в ближайшее время для уточнения деталей.
            </p>
            <div className="pt-4">
              <CyberpunkButton
                href="/"
                variant="primary"
                size="lg"
              >
                Вернуться на главную
              </CyberpunkButton>
            </div>
          </motion.div>
        </CyberpunkCard>
      </div>
    );
  }

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
                Оформление заявки
              </h1>
            </div>
            <p className="text-xl text-content-secondary max-w-2xl mx-auto leading-relaxed">
              Заполните форму, и наш менеджер свяжется с вами в ближайшее время
            </p>
          </motion.div>
        </div>
      </section>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CyberpunkProgressBar 
          value={state.step} 
          max={3} 
          showPercentage={false}
          className="mb-8"
        />
        <div className="text-center text-sm text-content-muted">
          Шаг {state.step} из 3
        </div>
      </div>

      {/* Booking Steps */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <AnimatePresence mode="wait">
          {/* Step 1: Service Selection */}
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
                  Выберите услугу
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {services.map((service, index) => (
                    <motion.div
                      key={service.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <CyberpunkCard
                        className={`p-6 cursor-pointer transition-all duration-300 ${
                          state.service === service.id
                            ? 'poison-border bg-poison-green/5'
                            : 'hover:border-poison-green/50'
                        }`}
                        onClick={() => selectService(service.id)}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onTouchStart={() => handleServiceTouchStart(index)}
                        onTouchEnd={handleServiceTouchEnd}
                      >
                        <div className="flex items-start space-x-4 mb-4">
                          <div className="p-2 bg-bg-secondary rounded-lg flex-shrink-0">
                            {service.id === 'disinfection' ? (
                              <AnimatedIcon 
                                animationName="antibiotic.json" 
                                className="h-10 w-10"
                                isHovered={hoveredIndex === index}
                              />
                            ) : service.id === 'pest-control' ? (
                              <AnimatedIcon 
                                animationName="insect.json" 
                                className="h-10 w-10"
                                isHovered={hoveredIndex === index}
                              />
                            ) : service.id === 'deratization' ? (
                              <AnimatedIcon 
                                animationName="mouse.json" 
                                className="h-10 w-10"
                                isHovered={hoveredIndex === index}
                              />
                            ) : service.id === 'water-analysis' ? (
                              <AnimatedIcon 
                                animationName="microscope.json" 
                                className="h-10 w-10"
                                isHovered={hoveredIndex === index}
                              />
                            ) : service.id === 'fumigation' ? (
                              <AnimatedIcon 
                                animationName="spray-bottle.json" 
                                className="h-10 w-10"
                                isHovered={hoveredIndex === index}
                                color="purple-500"
                              />
                            ) : service.id === 'deserpentation' ? (
                              <AnimatedIcon 
                                animationName="snake.json" 
                                className="h-10 w-10"
                                isHovered={hoveredIndex === index}
                                color="green-500"
                              />
                            ) : service.id === 'deodorization' ? (
                              <AnimatedIcon 
                                animationName="fresh.json" 
                                className="h-10 w-10"
                                isHovered={hoveredIndex === index}
                                color="amber-500"
                              />
                            ) : service.id === 'herbicide-treatment' ? (
                              <AnimatedIcon 
                                animationName="grass.json" 
                                className="h-10 w-10"
                                isHovered={hoveredIndex === index}
                                color="lime-500"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-orbitron font-semibold text-content-primary">
                                {service.title}
                              </h3>
                              {state.service === service.id && (
                                <Check className="h-6 w-6 text-poison-green flex-shrink-0" />
                              )}
                            </div>
                            
                            <p className="text-sm text-content-muted mb-3 leading-relaxed">
                              {service.description}
                            </p>
                            
                            <div className="text-sm text-content-muted">
                              Время выполнения: {service.duration}
                            </div>
                          </div>
                        </div>
                      </CyberpunkCard>
                    </motion.div>
                  ))}
                </div>
                
                <div className="flex justify-end">
                  <CyberpunkButton
                    onClick={nextStep}
                    disabled={!state.service}
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

          {/* Step 2: Object Type Selection */}
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
                        onMouseEnter={() => setObjectHoveredIndex(index)}
                        onMouseLeave={() => setObjectHoveredIndex(null)}
                        onTouchStart={() => handleObjectTouchStart(index)}
                        onTouchEnd={handleObjectTouchEnd}
                      >
                        <div className="text-center">
                          <AnimatedIcon
                            animationName={type.animationName}
                            className={`h-12 w-12 mx-auto mb-4 ${
                              state.objectType === type.id ? 'text-poison-green' : type.color
                            }`}
                            isHovered={objectHoveredIndex === index}
                          />
                          <h3 className="font-orbitron font-semibold text-content-primary mb-2">
                            {type.title}
                          </h3>
                          <p className="text-sm text-content-muted leading-relaxed">
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

          {/* Step 3: Contact Form */}
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
                  Как с вами связаться?
                </h2>
                
                {submitError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-500 text-sm">{submitError}</p>
                  </div>
                )}
                
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

                  <div>
                    <label className="block text-sm font-medium text-content-primary mb-2">
                      Дополнительная информация
                    </label>
                    <textarea
                      value={state.contactInfo.message}
                      onChange={(e) => updateContactInfo('message', e.target.value)}
                      placeholder="Опишите проблему или укажите дополнительные детали"
                      rows={4}
                      className="w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 transition-all duration-300 resize-none"
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
                    onClick={handleSubmit}
                    disabled={!state.contactInfo.name || !state.contactInfo.phone || isSubmitting}
                    variant="primary"
                    size="lg"
                  >
                    {isSubmitting ? (
                      'Отправка...'
                    ) : (
                      <>
                        Отправить заявку
                        <Send className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </CyberpunkButton>
                </div>
              </CyberpunkCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

