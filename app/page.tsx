'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, CheckCircle, Star, Phone, Calculator, Shield } from 'lucide-react';
import { ServiceIcon } from '@/components/ServiceIcon';
import { TrustFactorIcon } from '@/components/TrustFactorIcon';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { FloatingParticles } from '@/components/FloatingParticles';
import AnimatedIcon from '@/components/AnimatedIcon';

const services = [
  {
    title: 'Ликвидация вирусов и бактерий',
    description: 'Полное уничтожение патогенных микроорганизмов современными препаратами. Эффективность 99.9% против COVID-19, гриппа.',
    icon: 'bug',
    color: 'text-poison-green',
    href: '/services/disinfection',
  },
  {
    title: 'Тотальное уничтожение насекомых',
    description: 'Передовые методы борьбы с тараканами, клопами, муравьями. Барьерная защита на 12 месяцев.',
    icon: 'spray',
    color: 'text-neon-orange',
    href: '/services/pest-control',
  },
  {
    title: 'Полная ликвидация грызунов',
    description: 'Профессиональное уничтожение крыс и мышей. Безопасные приманки.',
    icon: 'rat',
    color: 'text-cyber-blue',
    href: '/services/deratization',
  },
  {
    title: 'Лабораторная диагностика качества',
    description: 'Комплексный анализ 24 показателей. Заключение аккредитованной лаборатории за 48 часов.',
    icon: 'beaker',
    color: 'text-electric-blue',
    href: '/services/water-analysis',
  },
];

const trustFactors = [
  {
    title: 'Полное соответствие законодательству',
    value: <a href="http://fp.crc.ru/" target="_blank" rel="noopener noreferrer" className="text-poison-green hover:text-neon-orange transition-colors font-orbitron">РОСПОТРЕБНАДЗОР</a>,
    icon: 'award',
    color: 'text-electric-blue',
  },
  {
    title: 'Оборудование нового поколения',
    value: '99.9% эффективность',
    icon: 'zap',
    color: 'text-neon-orange',
  },
  {
    title: 'Экстренный выезд 24/7',
    value: '2 часа до выезда',
    icon: 'clock',
    color: 'text-cyber-blue',
  },
];

export default function Home() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredTrustIndex, setHoveredTrustIndex] = useState<number | null>(null);
  
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
  
  const handleTrustTouchStart = (index: number) => {
    setHoveredTrustIndex(index);
  };
  
  const handleTrustTouchEnd = () => {
    // Не останавливаем анимацию сразу - даем доиграть до конца цикла
    // Анимация остановится автоматически через useEffect в AnimatedIcon
    // Используем стандартную длительность анимации (обычно 2 секунды)
    setTimeout(() => setHoveredTrustIndex(null), 2000);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary pt-24 pb-16">
        <FloatingParticles particleCount={50} strategy="client-only" />
        {/* Cyber Grid Background Pattern - Full Width */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-screen h-full">
            <svg className="w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
              <defs>
                <pattern id="cyber-grid" width="25" height="25" patternUnits="userSpaceOnUse">
                  <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#1E40AF" strokeWidth="0.8"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cyber-grid)" />
            </svg>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Hero Image */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden">
                <img
                  src="/images/hero-image.jpeg"
                  alt="Специалист DEZTECHYUG в современной защитной экипировке"
                  className="w-full h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-poison-green/20 via-transparent to-neon-orange/20" />
                
                {/* Floating Elements */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute top-8 right-8 bg-bg-primary/90 backdrop-blur-sm rounded-lg p-4 border border-poison-green/30"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-poison-green rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-content-primary">99.9% эффективность</span>
                  </div>
                </motion.div>
                
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                  className="absolute bottom-8 left-8 bg-bg-primary/90 backdrop-blur-sm rounded-lg p-4 border border-neon-orange/30"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-neon-orange rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-content-primary">24/7 поддержка</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div className="space-y-6">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="text-4xl md:text-5xl lg:text-6xl font-orbitron font-bold text-content-primary leading-tight"
                >
                  Дезинфекция{' '}
                  <span className="text-poison-green">будущего</span>{' '}
                  уже сегодня
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="text-xl text-content-secondary font-medium"
                >
                  Элитная команда технологичных специалистов. 10 лет безупречной работы.
                  Полное уничтожение угроз за 24 часа.
                </motion.p>
                
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                  className="text-lg text-content-muted"
                >
                  Мы не просто санитарная служба. Мы — профессионалы будущего, использующие
                  передовые технологии для защиты вашего здоровья и бизнеса. Лицензированные
                  специалисты, инновационное оборудование, гарантированный результат.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <CyberpunkButton
                  href="/calculator"
                  variant="primary"
                  size="lg"
                  className="pulse-cta group"
                >
                  <Calculator className="h-6 w-6 mr-3  group-hover:scale-110 transition-transform" />
                  <span className="inline-block">Рассчитать стоимость услуг</span>
                </CyberpunkButton>
                
                <CyberpunkButton
                  href="/contact"
                  variant="secondary"
                  size="lg"
                  className="group"
                >
                  <Phone className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                  <span className="inline-block">Вызвать специалиста сейчас</span>
                </CyberpunkButton>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
                className="flex flex-wrap gap-6 pt-4"
              >
                {['10 лет опыта', 'Инновационные технологии', 'Лицензированные специалисты'].map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-poison-green" />
                    <span className="text-sm font-medium text-content-primary">{item}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-orbitron font-bold text-content-primary mb-6">
              Арсенал технологий против{' '}
              <span className="text-poison-green">любых угроз</span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto">
              Каждая проблема требует точного решения. Наша команда использует 4 базовые 
              технологии для полного уничтожения биологических и химических угроз.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard 
                  variant="service" 
                  className="h-full p-6 group cursor-default"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onTouchStart={() => handleServiceTouchStart(index)}
                  onTouchEnd={handleServiceTouchEnd}
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      {index === 0 ? (
                        <AnimatedIcon 
                          animationName="antibiotic.json" 
                          className={`h-12 w-12 ${service.color} `}
                          isHovered={hoveredIndex === index}
                        />
                      ) : index === 1 ? (
                        <AnimatedIcon 
                          animationName="insect.json" 
                          className={`h-12 w-12 ${service.color} `}
                          isHovered={hoveredIndex === index}
                        />
                      ) : index === 2 ? (
                        <AnimatedIcon 
                          animationName="mouse.json" 
                          className={`h-12 w-12 ${service.color} `}
                          isHovered={hoveredIndex === index}
                        />
                      ) : index === 3 ? (
                        <AnimatedIcon 
                          animationName="microscope.json" 
                          className={`h-12 w-12 ${service.color} `}
                          isHovered={hoveredIndex === index}
                        />
                      ) : (
                        <ServiceIcon name={service.icon as 'bug' | 'spray' | 'rat' | 'beaker'} className={`h-12 w-12 ${service.color} `} />
                      )}
                    </div>
                    
                    <h3 className="text-xl font-orbitron font-semibold text-content-primary mb-3 group-hover:text-poison-green transition-colors">
                      {service.title}
                    </h3>
                    
                    <p className="text-content-secondary flex-1 mb-4">
                      {service.description}
                    </p>
                    
                    <Link 
                      href="/services"
                      className="flex items-center text-sm font-medium text-poison-green group-hover:text-neon-orange transition-colors"
                    >
                      Подробнее
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </CyberpunkCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-orbitron font-bold text-content-primary mb-6">
              10 лет защищаем ваше{' '}
              <span className="text-poison-green">здоровье и бизнес</span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto">
              Нас выбирают за результат, которому можно доверять. Каждый проект — это наша репутация.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {trustFactors.map((factor, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard 
                  className="text-center p-8 group"
                  onMouseEnter={() => setHoveredTrustIndex(index)}
                  onMouseLeave={() => setHoveredTrustIndex(null)}
                  onTouchStart={() => handleTrustTouchStart(index)}
                  onTouchEnd={handleTrustTouchEnd}
                >
                  <div className="mb-6">
                    {index === 0 ? (
                      <AnimatedIcon 
                        animationName="verified.json" 
                        className={`h-16 w-16 ${factor.color} mx-auto`}
                        isHovered={hoveredTrustIndex === index}
                      />
                    ) : index === 1 ? (
                      <AnimatedIcon 
                        animationName="brain-lightning.json" 
                        className={`h-16 w-16 ${factor.color} mx-auto`}
                        isHovered={hoveredTrustIndex === index}
                      />
                    ) : index === 2 ? (
                      <AnimatedIcon 
                        animationName="siren.json" 
                        className={`h-16 w-16 ${factor.color} mx-auto`}
                        isHovered={hoveredTrustIndex === index}
                      />
                    ) : (
                      <TrustFactorIcon name={factor.icon as 'award' | 'zap' | 'clock'} className={`h-16 w-16 ${factor.color} mx-auto `} />
                    )}
                  </div>
                  
                  <h3 className="text-xl font-orbitron font-semibold text-content-primary mb-3">
                    {factor.title}
                  </h3>
                  
                  <div className="text-3xl font-orbitron font-bold text-poison-green mb-2">
                    {factor.value}
                  </div>
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
              Готовы решить вашу проблему{' '}
              <span className="text-poison-green">прямо сейчас</span>?
            </h2>
            
            <p className="text-xl text-content-secondary">
              Получите бесплатную консультацию и точный расчет стоимости за 3 минуты
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <CyberpunkButton 
                href="/calculator"
                variant="primary"
                size="xl"
                className="pulse-cta"
              >
                <Calculator className="h-6 w-6 mr-3  group-hover:scale-110 transition-transform" />
                <span className="inline-block">Рассчитать стоимость</span>
              </CyberpunkButton>
              
              <CyberpunkButton 
                href="tel:+7XXXXXXXXXX"
                variant="secondary"
                size="xl"
              >
                <Phone className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                <span className="inline-block">Позвонить сейчас</span>
              </CyberpunkButton>
            </div>
            
            <div className="flex items-center justify-center space-x-6 text-sm text-content-muted">
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 text-poison-green" />
                <span>Бесплатная консультация</span>
              </div>
              <div className="flex items-center space-x-2">
                <TrustFactorIcon name="clock" className="h-4 w-4 text-neon-orange" />
                <span>Выезд в течение 2 часов</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-cyber-blue" />
                <span>Гарантия результата</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}