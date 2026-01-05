'use client';

import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { ServiceIcon } from '@/components/ServiceIcon';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import AnimatedIcon from '@/components/AnimatedIcon';
import { useState } from 'react';

const services = [
  {
    id: 'disinfection',
    title: 'Дезинфекция',
    subtitle: 'Полное уничтожение вирусов, бактерий и грибков',
    description: 'Профессиональная дезинфекция помещений препаратами 4-го поколения. Эффективность 99.9% против COVID-19, гриппа, норовируса, туберкулеза.',
    icon: 'bug',
    color: 'text-neon-orange',
    bgColor: 'bg-neon-orange/10',
    borderColor: 'border-neon-orange/30',
    features: [
      'Уничтожение всех известных патогенов',
      'Безопасные для людей и животных препараты',
      'Обработка любых типов помещений',
      'Сертифицированное оборудование',
      'Гарантия эффективности 99.9%'
    ],
    href: '/services/disinfection',
    price: 'от 150 ₽/м²',
    duration: '30 минут - 1,5 часа'
  },
  {
    id: 'pest-control',
    title: 'Дезинсекция',
    subtitle: 'Тотальное уничтожение насекомых-вредителей',
    description: 'Навсегда избавим от тараканов, клопов, муравьев и других насекомых. Барьерная защита на 12 месяцев. Безопасные препараты 4-го класса опасности.',
    icon: 'spray',
    color: 'text-poison-green',
    bgColor: 'bg-poison-green/10',
    borderColor: 'border-poison-green/30',
    features: [
      'Полное уничтожение всех видов насекомых',
      'Барьерная защита на 12 месяцев',
      'Безопасные инсектициды 4-го класса',
      'Обработка труднодоступных мест',
      'Гарантийное обслуживание'
    ],
    href: '/services/pest-control',
    price: 'от 200 ₽/м²',
    duration: '30 минут - 1,5 часа'
  },
  {
    id: 'deratization',
    title: 'Дератизация',
    subtitle: 'Полная ликвидация грызунов и защита от вторжения',
    description: 'Профессиональное уничтожение крыс и мышей современными методами. Герметизация путей проникновения. Защита имущества и здоровья от грызунов-вредителей.',
    icon: 'rat',
    color: 'text-cyber-blue',
    bgColor: 'bg-cyber-blue/10',
    borderColor: 'border-cyber-blue/30',
    features: [
      'Полное уничтожение колоний грызунов',
      'Герметизация путей проникновения',
      'Установка защитных барьеров',
      'Безопасные родентициды',
      'Профилактическое обслуживание'
    ],
    href: '/services/deratization',
    price: 'от 250 ₽/м²',
    duration: '30 минут - 1,5 часа'
  },
  {
    id: 'water-analysis',
    title: 'Анализ воды',
    subtitle: 'Лабораторный анализ воды: точность, которой можно доверять',
    description: 'Полное исследование качества воды по 47 показателям. Аккредитованная лаборатория, соответствие ГОСТ и СанПиН. Результаты за 24-48 часов с официальным протоколом.',
    icon: 'beaker',
    color: 'text-electric-blue',
    bgColor: 'bg-electric-blue/10',
    borderColor: 'border-electric-blue/30',
    features: [
      'Анализ по 47 показателям качества',
      'Аккредитованная лаборатория',
      'Соответствие ГОСТ и СанПиН',
      'Результаты за 24-48 часов',
      'Официальный протокол анализа'
    ],
    href: '/services/water-analysis',
    price: 'от 2500 ₽',
    duration: '24-48 часов'
  },
  {
    id: 'fumigation',
    title: 'Фумигация',
    subtitle: 'Газовая обработка для полного уничтожения вредителей',
    description: 'Профессиональная фумигация газообразными препаратами. Идеально для складских помещений, зернохранилищ и производственных объектов.',
    icon: 'spray',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    features: [
      'Уничтожение всех видов вредителей',
      'Проникновение в труднодоступные места',
      'Безопасная технология обработки',
      'Эффективность 100%'
    ],
    href: '/services/fumigation',
    price: 'от 300 ₽/м²',
    duration: '30 минут - 1,5 часа'
  },
  {
    id: 'deserpentation',
    title: 'Десерпентация',
    subtitle: 'Уничтожение змей и пресмыкающихся',
    description: 'Безопасное и эффективное удаление змей и других пресмыкающихся с территории. Защита людей и животных от опасных рептилий.',
    icon: 'bug',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    features: [
      'Безопасное удаление змей',
      'Защита территории',
      'Профилактические меры',
      'Профессиональный подход'
    ],
    href: '/services/deserpentation',
    price: 'от 5000 ₽',
    duration: '1 час - 2,5 часа'
  },
  {
    id: 'deodorization',
    title: 'Дезодорация',
    subtitle: 'Устранение неприятных запахов',
    description: 'Эффективное устранение любых неприятных запахов в помещениях. Используем современные технологии нейтрализации запахов.',
    icon: 'spray',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    features: [
      'Устранение любых запахов',
      'Долговременный эффект',
      'Безопасные препараты',
      'Быстрый результат'
    ],
    href: '/services/deodorization',
    price: 'от 200 ₽/м²',
    duration: '30 минут - 1,5 часа'
  },
  {
    id: 'herbicide-treatment',
    title: 'Гербицидная обработка',
    subtitle: 'Уничтожение сорняков и нежелательной растительности',
    description: 'Эффективное уничтожение сорняков и нежелательной растительности на участках. Используем сертифицированные гербициды.',
    icon: 'bug',
    color: 'text-lime-500',
    bgColor: 'bg-lime-500/10',
    borderColor: 'border-lime-500/30',
    features: [
      'Уничтожение всех видов сорняков',
      'Долговременный эффект',
      'Безопасные препараты',
      'Защита культурных растений'
    ],
    href: '/services/herbicide-treatment',
    price: 'от 150 ₽/сотка',
    duration: '2-4 часа'
  }
];

export default function ServicesPage() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [whyChooseUsHoveredIndex, setWhyChooseUsHoveredIndex] = useState<number | null>(null);
  
  // Обработчики для touch событий
  const handleServiceTouchStart = (index: number) => {
    setHoveredIndex(index);
  };
  
  const handleServiceTouchEnd = () => {
    // Не останавливаем анимацию сразу - даем доиграть до конца цикла
    // Анимация остановится автоматически через useEffect в AnimatedIcon
    // Используем стандартную длительность анимации (обычно 2 секунды)
    setTimeout(() => setHoveredIndex(null), 2000);
  };
  
  const handleWhyChooseUsTouchStart = (index: number) => {
    setWhyChooseUsHoveredIndex(index);
  };
  
  const handleWhyChooseUsTouchEnd = () => {
    // Не останавливаем анимацию сразу - даем доиграть до конца цикла
    // Анимация остановится автоматически через useEffect в AnimatedIcon
    // Используем стандартную длительность анимации (обычно 2 секунды)
    setTimeout(() => setWhyChooseUsHoveredIndex(null), 2000);
  };

  return (
    <div className="min-h-screen pt-24">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-6"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-orbitron font-bold text-content-primary">
              Полный спектр{' '}
              <span className="text-poison-green">профессиональных услуг</span>
            </h1>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto leading-relaxed">
              Комплексные решения для защиты вашего здоровья, бизнеса и имущества.
              <br className="hidden sm:block" />
              Современные технологии, проверенные методы, гарантированный результат.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {services.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard variant="service" className="h-full">
                  <div 
                    className={`${service.bgColor} ${service.borderColor} border-l-4 p-8 flex flex-col h-full`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onTouchStart={() => handleServiceTouchStart(index)}
                    onTouchEnd={handleServiceTouchEnd}
                  >
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start space-x-4 mb-6">
                        <div className={`${service.bgColor} p-3 rounded-lg`}>
                          {service.id === 'disinfection' ? (
                            <AnimatedIcon 
                              animationName="antibiotic.json" 
                              className="h-12 w-12"
                              isHovered={hoveredIndex === index}
                            />
                          ) : service.id === 'pest-control' ? (
                            <AnimatedIcon 
                              animationName="insect.json" 
                              className="h-12 w-12"
                              isHovered={hoveredIndex === index}
                            />
                          ) : service.id === 'deratization' ? (
                            <AnimatedIcon 
                              animationName="mouse.json" 
                              className="h-12 w-12"
                              isHovered={hoveredIndex === index}
                            />
                          ) : service.id === 'water-analysis' ? (
                            <AnimatedIcon 
                              animationName="microscope.json" 
                              className="h-12 w-12"
                              isHovered={hoveredIndex === index}
                            />
                          ) : service.id === 'fumigation' ? (
                            <AnimatedIcon 
                              animationName="spray-bottle.json" 
                              className="h-12 w-12"
                              isHovered={hoveredIndex === index}
                              color="purple-500"
                            />
                          ) : service.id === 'deserpentation' ? (
                            <AnimatedIcon 
                              animationName="snake.json" 
                              className="h-12 w-12"
                              isHovered={hoveredIndex === index}
                              color="green-500"
                            />
                          ) : service.id === 'deodorization' ? (
                            <AnimatedIcon 
                              animationName="fresh.json" 
                              className="h-12 w-12"
                              isHovered={hoveredIndex === index}
                              color="amber-500"
                            />
                          ) : service.id === 'herbicide-treatment' ? (
                            <AnimatedIcon 
                              animationName="grass.json" 
                              className="h-12 w-12"
                              isHovered={hoveredIndex === index}
                              color="lime-500"
                            />
                          ) : (
                            <ServiceIcon name={service.icon as 'bug' | 'spray' | 'rat' | 'beaker'} className={`h-8 w-8 ${service.color}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <h2 className="text-2xl font-orbitron font-bold text-content-primary mb-2">
                            {service.title}
                          </h2>
                          <h3 className="text-lg font-medium text-content-secondary mb-3">
                            {service.subtitle}
                          </h3>
                          <p className="text-content-muted leading-relaxed">
                            {service.description}
                          </p>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="space-y-3 mb-6 flex-1">
                        {service.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="flex items-center space-x-3">
                            <CheckCircle className={`h-5 w-5 ${service.color} flex-shrink-0`} />
                            <span className="text-sm text-content-secondary leading-relaxed">{feature}</span>
                          </div>
                        ))}
                      </div>

                      {/* Price and Duration */}
                      <div className="flex items-center justify-between mb-6 p-4 bg-bg-primary rounded-lg border border-gray-200">
                        <div>
                          <div className="text-sm text-content-muted">Стоимость</div>
                          <div className="text-lg font-orbitron font-bold text-poison-green">
                            {service.price}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-content-muted">Время выполнения</div>
                          <div className="text-lg font-orbitron font-bold text-neon-orange">
                            {service.duration}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                      <CyberpunkButton
                        variant="primary"
                        size="default"
                        className="flex-1 group opacity-50 cursor-not-allowed"
                        onClick={(e) => e.preventDefault()}
                        disabled
                      >
                        Подробнее
                        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </CyberpunkButton>
                      <CyberpunkButton
                        href="/booking"
                        variant="secondary"
                        size="default"
                        className="flex-1"
                      >
                        Оформить заявку
                      </CyberpunkButton>
                    </div>
                  </div>
                </CyberpunkCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary mb-6">
              Почему выбирают{' '}
              <span className="font-bebas">
                <span style={{ color: '#e20819' }}>ДЕЗ</span>
                <span style={{ color: '#4cb032' }}>ТЕХ</span>
                <span style={{ color: '#e20819' }}>ЮГ</span>
              </span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto leading-relaxed">
              Комплексный подход к решению проблем, современное оборудование и опыт более 5 лет
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: 'Лицензированные специалисты',
                description: 'Лицензированные специалисты, регулярное повышение квалификации',
                animationName: 'teamwork.json',
                color: 'text-cyber-blue'
              },
              {
                title: 'Современное оборудование',
                description: 'Генераторы тумана, УЛВ распылители, дозирующие системы',
                animationName: 'skills.json',
                color: 'text-neon-orange'
              },
              {
                title: 'Безопасные препараты',
                description: 'Сертифицированные средства 4-го класса опасности',
                animationName: 'report.json',
                color: 'text-cyber-blue'
              },
              {
                title: 'Гарантия результата',
                description: 'Письменная гарантия и гарантийное обслуживание',
                animationName: 'certificate.json',
                color: 'text-poison-green'
              },
              {
                title: 'Круглосуточная работа',
                description: 'Экстренный выезд 24/7, работа в выходные и праздники',
                animationName: '24-hour-service.json',
                color: 'text-neon-orange'
              },
              {
                title: 'Полный цикл услуг',
                description: 'От диагностики до профилактического обслуживания',
                animationName: 'management.json',
                color: 'text-cyber-blue'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard 
                  className="text-center p-6 h-full"
                  onMouseEnter={() => setWhyChooseUsHoveredIndex(index)}
                  onMouseLeave={() => setWhyChooseUsHoveredIndex(null)}
                  onTouchStart={() => handleWhyChooseUsTouchStart(index)}
                  onTouchEnd={handleWhyChooseUsTouchEnd}
                >
                  <AnimatedIcon
                    animationName={item.animationName}
                    className={`h-12 w-12 ${item.color} mx-auto mb-4`}
                    isHovered={whyChooseUsHoveredIndex === index}
                  />
                  <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-3">
                    {item.title}
                  </h3>
                  <p className="text-content-secondary text-sm leading-relaxed">
                    {item.description}
                  </p>
                </CyberpunkCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-poison-green/10 via-bg-secondary to-neon-orange/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary">
              Нужна помощь в выборе услуги?
            </h2>
            <p className="text-xl text-content-secondary leading-relaxed">
              Получите бесплатную консультацию специалиста и персональный расчет стоимости
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <CyberpunkButton 
                href="/booking"
                variant="primary"
                size="lg"
                className="pulse-cta"
              >
                Оформить заявку
              </CyberpunkButton>
              <CyberpunkButton 
                href="/contact"
                variant="secondary"
                size="lg"
              >
                Получить консультацию
              </CyberpunkButton>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}