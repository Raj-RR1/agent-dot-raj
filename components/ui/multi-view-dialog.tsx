"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ExtenstionContext } from "@/providers/extension-provider";
import { AnimatePresence, motion } from "framer-motion";
import { use, useCallback, useEffect, useRef, useState } from "react";

export interface ViewNavigationProps {
  next?: () => void;
  previous?: () => void;
}

export interface ViewMetadata {
  title: string;
  description?: string;
  isMobile?: boolean;
}

export interface ViewContentProps extends ViewNavigationProps, ViewMetadata {}

export type DialogView = ViewMetadata & {
  content: (navigation: ViewNavigationProps) => React.ReactNode;
};

export interface ViewProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, keyof ViewMetadata>,
    ViewMetadata {}

export interface MultiViewDialogProps {
  trigger: React.ReactNode;
  views: DialogView[];
  initialView?: number;
}

function View({ title, description, isMobile, children, ...props }: ViewProps) {
  if (isMobile) {
    return (
      <div {...props}>
        <DrawerHeader>
          <DrawerTitle className="pl-1 text-[1.2rem] font-semibold">
            {title}
          </DrawerTitle>
          {description && (
            <DrawerDescription className="font-manrope text-info text-left text-sm font-medium">
              {description}
            </DrawerDescription>
          )}
        </DrawerHeader>
        {children}
      </div>
    );
  }
  return (
    <div {...props}>
      <SheetHeader>
        <SheetTitle className="pl-1 text-[1.2rem] font-semibold">
          {title}
        </SheetTitle>
        {description && (
          <SheetDescription className="font-manrope text-info text-left text-sm font-medium">
            {description}
          </SheetDescription>
        )}
      </SheetHeader>
      {children}
    </div>
  );
}

function MultiView({
  height,
  direction,
  ref,
  currentView,
  views,
  handleNext,
  handlePrevious,
}: {
  height: number | "auto";
  direction: number;
  ref: (node: HTMLDivElement) => void;
  currentView: number;
  views: DialogView[];
  handleNext: () => void;
  handlePrevious: () => void;
}) {
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
    }),
    center: {
      x: 0,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? "-100%" : "100%",
    }),
  };
  return (
    <motion.div
      className="relative my-2 w-full overflow-hidden"
      style={{
        height: height,
      }}
      animate={{ height }}
      transition={{
        duration: 0.2,
      }}
    >
      <AnimatePresence custom={direction} mode="wait" initial={false}>
        <motion.div
          key={currentView}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "tween", duration: 0.15 },
            opacity: { type: "tween", duration: 0.15 },
          }}
          style={{ width: "100%" }}
          className="w-full"
        >
          <div ref={ref}>
            <View
              title={views[currentView].title}
              description={views[currentView].description}
            >
              {views[currentView].content({
                next: handleNext,
                previous: handlePrevious,
              })}
            </View>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export function MultiViewDialog({
  trigger,
  views,
  initialView = 0,
}: MultiViewDialogProps) {
  const { isWalletOpen, setIsWalletOpen } = use(ExtenstionContext);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [currentView, setCurrentView] = useState(initialView);
  const [direction, setDirection] = useState<number>(0);
  const [height, setHeight] = useState<number | "auto">("auto");
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (isWalletOpen) {
      setCurrentView(initialView);
      setDirection(0);
    }
  }, [isWalletOpen, initialView]);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        const entry = entries[0];
        setHeight(entry.contentRect.height);
      });
      resizeObserverRef.current.observe(node);
    } else if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
  }, []);

  function handleNext() {
    if (currentView < views.length - 1) {
      setDirection(1);
      setCurrentView(currentView + 1);
    }
  }

  function handlePrevious() {
    if (currentView > 0) {
      setDirection(-1);
      setCurrentView(currentView - 1);
    }
  }

  function handleOpenChange(open: boolean) {
    setIsWalletOpen(open);
  }

  if (!isMobile) {
    return (
      <Sheet open={isWalletOpen} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent className="border-border my-auto mr-2 h-[calc(100%-24px)] rounded-2xl border p-2 outline-none">
          <MultiView
            height={height}
            direction={direction}
            ref={containerRef}
            currentView={currentView}
            views={views}
            handleNext={handleNext}
            handlePrevious={handlePrevious}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={isWalletOpen} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="bg-background border-border max-h-[90vh] min-h-[20vh] w-full p-2">
        <MultiView
          height={height}
          direction={direction}
          ref={containerRef}
          currentView={currentView}
          views={views}
          handleNext={handleNext}
          handlePrevious={handlePrevious}
        />
      </DrawerContent>
    </Drawer>
  );
}
