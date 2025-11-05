#define _CRT_SECURE_NO_WARNINGS 1

#include "contact.h"

// 💡 打印菜单界面
void menu(void)
{
    printf("\n*************************************************\n");
    printf("*****          欢迎使用个人通讯录系统       *****\n");
    printf("*************************************************\n");
    printf("*****    1. 增加联系人     2. 删除联系人    *****\n");
    printf("*****    3. 查找联系人     4. 修改联系人    *****\n");
    printf("*****    5. 显示所有人员   6. 排序联系人    *****\n");
    printf("*****    0. 退出通讯录系统                  *****\n");
    printf("*************************************************\n");
}

int main(void)
{
    int input = 0;
    
    // 💡 创建通讯录实体并初始化
    Contact con;
    InitContact(&con);

    do
    {
        menu();
        printf("请选择操作 (0-6): ");
        
        // 💡 健壮的输入校验
        //    如果用户乱敲字符 (如字母 'a'), scanf 会匹配失败返回 0.
        //    这时需要清空缓冲区并重新输入, 防止程序陷入疯狂刷屏的死循环.
        if (scanf("%d", &input) != 1)
        {
            printf("输入无效! 请输入 0 到 6 之间的数字.\n");
            // 清空缓冲区
            int c;
            while ((c = getchar()) != '\n' && c != EOF)
            {
                ;
            }
            continue;
        }

        switch (input)
        {
            case ADD: // 1
                AddContact(&con);
                break;
            case DEL: // 2
                DelContact(&con);
                break;
            case SEARCH: // 3
                SearchContact(&con);
                break;
            case MODIFY: // 4
                ModifyContact(&con);
                break;
            case SHOW: // 5
                ShowContact(&con);
                break;
            case SORT: // 6
                SortContact(&con);
                break;
            case EXIT: // 0
                printf("感谢使用, 系统已安全退出.\n");
                break;
            default:
                printf("选择错误! 请选择 0 到 6 之间的操作编号.\n");
                break;
        }
    } while (input != EXIT);

    return 0;
}
