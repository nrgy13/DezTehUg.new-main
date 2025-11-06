'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Award, Users, Target, Clock, Zap } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import AnimatedIcon from '@/components/AnimatedIcon';

const teamMembers = [
  {
    name: 'Алексей Петров',
    role: 'Главный технолог',
    experience: '12 лет опыта',
    specialization: 'Дезинфекция и дезинсекция',
    icon: Shield,
  },
  {
    name: 'Мария Сидорова',
    role: 'Ведущий специалист',
    experience: '8 лет опыта',
    specialization: 'Анализ воды и лабораторные исследования',
    icon: Award,
  },
  {
    name: 'Дмитрий Козлов',
    role: 'Старший дезинфектор',
    experience: '10 лет опыта',
    specialization: 'Дератизация и комплексная обработка',
    icon: Target,
  },
];

const achievements = [
  {
    title: 'Более 5000 объектов обработано',
    description: 'Жилые дома, офисы, медучреждения, производства',
    icon: Users,
    animationName: 'city.json',
    color: 'text-neon-orange',
  },
  {
    title: '99.9% эффективность обработки',
    description: 'Подтверждено лабораторными исследованиями',
    icon: Target,
    animationName: 'goals.json',
    color: 'text-poison-green',
  },
  {
    title: '15 действующих лицензий',
    description: 'Полное соответствие требованиям Роспотребнадзора',
    icon: Award,
    animationName: 'patent.json',
    color: 'text-cyber-blue',
  },
  {
    title: '24/7 экстренная служба',
    description: 'Круглосуточная готовность к выезду',
    icon: Clock,
    animationName: 'alert.json',
    color: 'text-red-500',
  },
];

const values = [
  {
    title: 'Инновации',
    description: 'Используем только современные технологии и препараты последнего поколения',
    icon: Zap,
    animationName: 'dropper.json',
    color: 'text-poison-green',
  },
  {
    title: 'Безопасность',
    description: 'Все препараты сертифицированы и безопасны для людей и животных',
    icon: Shield,
    animationName: 'shield.json',
    color: 'text-poison-green',
  },
  {
    title: 'Результат',
    description: 'Гарантируем 100% уничтожение вредителей с письменной гарантией',
    icon: Target,
    animationName: 'goals.json',
    color: 'text-poison-green',
  },
  {
    title: 'Профессионализм',
    description: 'Команда лицензированных специалистов с многолетним опытом',
    icon: Award,
    animationName: 'certificate (1).json',
    color: 'text-poison-green',
  },
];

export default function AboutPage() {
  const [achievementsHoveredIndex, setAchievementsHoveredIndex] = useState<number | null>(null);
  const [valuesHoveredIndex, setValuesHoveredIndex] = useState<number | null>(null);
  
  // Обработчики для touch событий с предотвращением конфликтов
  const handleAchievementTouchStart = (index: number) => {
    setAchievementsHoveredIndex(index);
  };
  
  const handleAchievementTouchEnd = () => {
    // Небольшая задержка для завершения анимации
    setTimeout(() => setAchievementsHoveredIndex(null), 500);
  };
  
  const handleValueTouchStart = (index: number) => {
    setValuesHoveredIndex(index);
  };
  
  const handleValueTouchEnd = () => {
    // Небольшая задержка для завершения анимации
    setTimeout(() => setValuesHoveredIndex(null), 500);
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
              10 лет защищаем ваше{' '}
              <span className="text-poison-green">здоровье и бизнес</span>
            </h1>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto">
              Мы превратили обычную санитарную службу в команду технологичных специалистов, 
              которые решают задачи, недоступные другим.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary">
                Технологии будущего для{' '}
                <span className="text-poison-green">здоровья сегодня</span>
              </h2>
              <p className="text-lg text-content-secondary">
                Мы создаем мир, где биологические угрозы не могут навредить людям и бизнесу. 
                Каждый день наша команда использует передовые технологии для защиты того, 
                что важно для вас — здоровья семьи, успеха компании, чистоты производства.
              </p>
              <p className="text-content-muted">
                Наша миссия — не просто уничтожить вредителей, а создать долгосрочную защиту 
                с использованием инновационных методов и экологически безопасных препаратов.
              </p>
              <CyberpunkButton 
                href="/services"
                variant="primary"
                size="lg"
                className="group"
              >
                Наши технологии
                <Zap className="h-5 w-5 ml-2 " />
              </CyberpunkButton>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              <img
                src="https://images.pexels.com/photos/4167541/pexels-photo-4167541.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Команда DEZTECHYUG за работой"
                className="w-full h-[400px] object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-poison-green/20 via-transparent to-neon-orange/20 rounded-lg" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Achievements Section */}
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
              Наши достижения говорят{' '}
              <span className="text-poison-green">сами за себя</span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto">
              За 10 лет работы мы накопили впечатляющую статистику успешных проектов
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {achievements.map((achievement, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard 
                  className="text-center p-6 h-full"
                  onMouseEnter={() => setAchievementsHoveredIndex(index)}
                  onMouseLeave={() => setAchievementsHoveredIndex(null)}
                  onTouchStart={() => handleAchievementTouchStart(index)}
                  onTouchEnd={handleAchievementTouchEnd}
                >
                  <AnimatedIcon
                    animationName={achievement.animationName}
                    className={`h-12 w-12 mx-auto mb-4 ${achievement.color}`}
                    isHovered={achievementsHoveredIndex === index}
                  />
                  <h3 className="text-lg font-orbitron font-semibold text-content-primary mb-3">
                    {achievement.title}
                  </h3>
                  <p className="text-content-secondary text-sm">
                    {achievement.description}
                  </p>
                </CyberpunkCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-content-primary mb-6">
              Команда{' '}
              <span className="text-poison-green">профессионалов</span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto">
              Каждый специалист нашей команды — эксперт в своей области с многолетним опытом
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard className="p-6 text-center">
                  <h3 className="text-xl font-orbitron font-semibold text-content-primary mb-2">
                    {member.name}
                  </h3>
                  <div className="text-neon-orange font-medium mb-2">
                    {member.role}
                  </div>
                  <div className="text-sm text-content-secondary mb-3">
                    {member.experience}
                  </div>
                  <p className="text-sm text-content-muted">
                    {member.specialization}
                  </p>
                </CyberpunkCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
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
              Наши{' '}
              <span className="text-poison-green">принципы работы</span>
            </h2>
            <p className="text-xl text-content-secondary max-w-3xl mx-auto">
              Четыре основных принципа, которые определяют качество наших услуг
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <CyberpunkCard 
                  className="p-6 h-full"
                  onMouseEnter={() => setValuesHoveredIndex(index)}
                  onMouseLeave={() => setValuesHoveredIndex(null)}
                  onTouchStart={() => handleValueTouchStart(index)}
                  onTouchEnd={handleValueTouchEnd}
                >
                  <div className="flex items-start space-x-4">
                    <div className="p-3 rounded-lg">
                      <AnimatedIcon
                        animationName={value.animationName}
                        className={`h-12 w-12 ${value.color}`}
                        isHovered={valuesHoveredIndex === index}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-orbitron font-semibold text-content-primary mb-3">
                        {value.title}
                      </h3>
                      <p className="text-content-secondary">
                        {value.description}
                      </p>
                    </div>
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
              Готовы стать частью нашей{' '}
              <span className="text-poison-green">истории успеха</span>?
            </h2>
            <p className="text-xl text-content-secondary">
              Присоединяйтесь к тысячам довольных клиентов, которые доверили нам защиту своего здоровья и бизнеса
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <CyberpunkButton 
                href="/calculator"
                variant="primary"
                size="lg"
                className="pulse-cta"
              >
                Рассчитать стоимость
              </CyberpunkButton>
              <CyberpunkButton 
                href="/contact"
                variant="secondary"
                size="lg"
              >
                Связаться с нами
              </CyberpunkButton>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}